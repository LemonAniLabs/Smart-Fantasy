import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import axios from 'axios'
import { supabase } from '@/lib/supabase/client'

const YAHOO_FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'

// 2024-25 NBA season started on October 22, 2024
const NBA_SEASON_START = new Date('2024-10-22')

interface GameLog {
  date: string
  stats: Record<string, number>
  hasGame: boolean
  opponent?: string
  home_away?: 'home' | 'away'
  minutes_played?: number
  game_result?: 'W' | 'L' | 'T'
}

/**
 * Fetch game logs from Supabase cache
 */
async function getGameLogsFromCache(playerKey: string, dates: string[]): Promise<Map<string, GameLog>> {
  // If Supabase is not configured, return empty cache
  if (!supabase) {
    console.log('Supabase not configured, skipping cache check')
    return new Map()
  }

  try {
    const { data, error } = await supabase
      .from('player_game_logs')
      .select('game_date, stats, opponent, home_away, minutes_played, game_result')
      .eq('player_key', playerKey)
      .in('game_date', dates)

    if (error) {
      console.error('Error fetching from Supabase:', error)
      return new Map()
    }

    const cacheMap = new Map<string, GameLog>()
    data?.forEach(row => {
      cacheMap.set(row.game_date, {
        date: row.game_date,
        stats: row.stats as Record<string, number>,
        hasGame: true,
        opponent: row.opponent || undefined,
        home_away: row.home_away as 'home' | 'away' | undefined,
        minutes_played: row.minutes_played || undefined,
        game_result: row.game_result as 'W' | 'L' | 'T' | undefined
      })
    })

    return cacheMap
  } catch (error) {
    console.error('Error in getGameLogsFromCache:', error)
    return new Map()
  }
}

/**
 * Save game log to Supabase cache
 */
async function saveGameLogToCache(playerKey: string, playerName: string, gameLog: GameLog): Promise<void> {
  // If Supabase is not configured, skip saving
  if (!supabase) {
    return
  }

  try {
    const { error } = await supabase
      .from('player_game_logs')
      .upsert({
        player_key: playerKey,
        player_name: playerName,
        game_date: gameLog.date,
        stats: gameLog.stats,
        opponent: gameLog.opponent || null,
        home_away: gameLog.home_away || null,
        minutes_played: gameLog.minutes_played || null,
        game_result: gameLog.game_result || null
      }, {
        onConflict: 'player_key,game_date'
      })

    if (error) {
      console.error('Error saving to Supabase:', error)
    }
  } catch (error) {
    console.error('Error in saveGameLogToCache:', error)
  }
}

/**
 * Get player's game-by-game stats for the current season
 * GET /api/yahoo/player-season-games?playerKey=xxx&limit=10
 *
 * This endpoint fetches date-by-date stats from Yahoo Fantasy API
 * to build a complete game log for the season.
 *
 * Note: Only includes dates where the player had a game (non-empty stats)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in with Yahoo.' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const playerKey = searchParams.get('playerKey')
    const limitParam = searchParams.get('limit') || '10' // Default: last 10 games

    if (!playerKey) {
      return NextResponse.json(
        { error: 'playerKey parameter is required' },
        { status: 400 }
      )
    }

    const limit = parseInt(limitParam)
    if (isNaN(limit) || limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: 'limit must be between 1 and 50' },
        { status: 400 }
      )
    }

    console.log(`Fetching last ${limit} games for player ${playerKey}`)

    // Get dates to check (from today backwards)
    const today = new Date()
    const datesToCheck: string[] = []
    const currentDate = new Date(today)

    // Go back up to 150 days to find {limit} games (NBA season is ~180 days)
    const maxDaysToCheck = Math.min(150, limit * 5) // Estimate: ~5 days per game

    for (let i = 0; i < maxDaysToCheck; i++) {
      if (currentDate < NBA_SEASON_START) break

      // Format as YYYY-MM-DD
      const dateStr = currentDate.toISOString().split('T')[0]
      datesToCheck.push(dateStr)

      // Go back one day
      currentDate.setDate(currentDate.getDate() - 1)
    }

    console.log(`Checking ${datesToCheck.length} dates from ${datesToCheck[datesToCheck.length - 1]} to ${datesToCheck[0]}`)

    // Check cache first
    console.log(`Checking Supabase cache for ${playerKey}...`)
    const cacheMap = await getGameLogsFromCache(playerKey, datesToCheck)
    console.log(`Found ${cacheMap.size} cached games`)

    // Fetch stats for each date
    const gameLogs: GameLog[] = []
    let requestCount = 0
    let cacheHits = 0
    let playerName = '' // Will be populated from first API response

    for (const date of datesToCheck) {
      // Stop if we've found enough games
      if (gameLogs.length >= limit) break

      // Check cache first
      const cachedGame = cacheMap.get(date)
      if (cachedGame) {
        gameLogs.push(cachedGame)
        cacheHits++
        console.log(`Cache hit for ${date}`)
        continue
      }

      // Not in cache, fetch from Yahoo API
      try {
        const url = `${YAHOO_FANTASY_API_BASE}/player/${playerKey}/stats;type=date;date=${date}?format=json`

        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: 'application/json',
          },
        })

        requestCount++

        const playerData = response.data?.fantasy_content?.player
        if (!playerData || !Array.isArray(playerData) || playerData.length < 2) {
          continue
        }

        // Get player name if not already set
        if (!playerName && playerData[0]?.name?.full) {
          playerName = playerData[0].name.full
        }

        const playerStats = playerData[1]?.player_stats
        if (!playerStats || typeof playerStats !== 'object') {
          continue
        }

        const stats = playerStats.stats
        if (!stats || !Array.isArray(stats) || stats.length === 0) {
          continue
        }

        // Check if player had a game (stats should not all be "-")
        const hasGame = stats.some((stat: { stat: { value: string } }) =>
          stat.stat.value !== '-' && stat.stat.value !== '0'
        )

        if (!hasGame) {
          continue
        }

        // Convert stats array to object
        const statsObject: Record<string, number> = {}
        let minutesPlayed: number | undefined

        stats.forEach((statItem: { stat: { stat_id: string; value: string } }) => {
          const statId = statItem.stat.stat_id
          const value = statItem.stat.value

          // Convert to number if possible
          const numValue = parseFloat(value)
          if (!isNaN(numValue)) {
            statsObject[statId] = numValue

            // Stat ID 3 is typically minutes played (MIN)
            if (statId === '3') {
              minutesPlayed = numValue
            }
          }
        })

        const gameLog: GameLog = {
          date,
          stats: statsObject,
          hasGame: true,
          minutes_played: minutesPlayed,
          // opponent, home_away, and game_result will be added in Phase 2.2
          // when we integrate with NBA Stats API or Yahoo scoreboard endpoint
        }

        gameLogs.push(gameLog)
        console.log(`Found game on ${date} - ${Object.keys(statsObject).length} stats${minutesPlayed ? `, ${minutesPlayed} min` : ''}`)

        // Save to cache (don't await, let it run in background)
        if (playerName) {
          saveGameLogToCache(playerKey, playerName, gameLog).catch(err => {
            console.error('Failed to save to cache:', err)
          })
        }

      } catch (error) {
        console.error(`Error fetching stats for ${date}:`, error)
        // Continue to next date
      }

      // Add small delay to avoid rate limiting (200ms between requests)
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log(`Found ${gameLogs.length} games in ${requestCount} API requests (${cacheHits} from cache)`)

    return NextResponse.json({
      playerKey,
      gamesFound: gameLogs.length,
      requestsMade: requestCount,
      cacheHits,
      fromCache: cacheHits > 0,
      gameLogs,
    })

  } catch (error: unknown) {
    console.error('Error in /api/yahoo/player-season-games:', error)
    const err = error as Error & { status?: number }

    return NextResponse.json(
      { error: err.message || 'Failed to fetch player season games' },
      { status: 500 }
    )
  }
}
