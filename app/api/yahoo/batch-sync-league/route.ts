import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import axios from 'axios'
import { supabase } from '@/lib/supabase/client'

const YAHOO_FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'
const NBA_SEASON_START = new Date('2025-10-21')

interface GameLog {
  date: string
  stats: Record<string, number>
  hasGame: boolean
  minutes_played?: number
}

interface PlayerSyncResult {
  playerKey: string
  playerName: string
  status: 'success' | 'error' | 'skipped'
  gamesAdded: number
  apiCalls: number
  error?: string
}

/**
 * Get all players in a league
 */
async function getLeaguePlayers(leagueKey: string, accessToken: string): Promise<string[]> {
  try {
    const url = `${YAHOO_FANTASY_API_BASE}/league/${leagueKey}/players;count=300?format=json`

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    const players = response.data?.fantasy_content?.league?.[1]?.players

    if (!players || typeof players !== 'object') {
      return []
    }

    const playerKeys: string[] = []

    // Yahoo API returns players as an object with numeric keys
    Object.keys(players).forEach(key => {
      if (key === 'count') return

      const playerData = players[key]?.player
      if (playerData && Array.isArray(playerData) && playerData[0]?.player_key) {
        playerKeys.push(playerData[0].player_key)
      }
    })

    return playerKeys
  } catch (error) {
    console.error('Error fetching league players:', error)
    return []
  }
}

/**
 * Get existing dates for a player
 */
async function getExistingDates(playerKey: string): Promise<Set<string>> {
  if (!supabase) return new Set()

  try {
    const { data, error } = await supabase
      .from('player_game_logs')
      .select('game_date')
      .eq('player_key', playerKey)

    if (error) return new Set()
    return new Set(data?.map(row => row.game_date) || [])
  } catch (error) {
    return new Set()
  }
}

/**
 * Fetch and save game log for a specific date
 */
async function fetchAndSaveGameLog(
  playerKey: string,
  date: string,
  accessToken: string
): Promise<{ success: boolean; playerName: string; hasGame: boolean }> {
  try {
    const url = `${YAHOO_FANTASY_API_BASE}/player/${playerKey}/stats;type=date;date=${date}?format=json`

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    const playerData = response.data?.fantasy_content?.player
    if (!playerData || !Array.isArray(playerData) || playerData.length < 2) {
      return { success: false, playerName: '', hasGame: false }
    }

    const playerName = playerData[0]?.name?.full || ''
    const playerStats = playerData[1]?.player_stats

    if (!playerStats || typeof playerStats !== 'object') {
      return { success: false, playerName, hasGame: false }
    }

    const stats = playerStats.stats
    if (!stats || !Array.isArray(stats) || stats.length === 0) {
      return { success: false, playerName, hasGame: false }
    }

    const hasGame = stats.some((stat: { stat: { value: string } }) =>
      stat.stat.value !== '-' && stat.stat.value !== '0'
    )

    if (!hasGame) {
      return { success: true, playerName, hasGame: false }
    }

    // Parse stats
    const statsObject: Record<string, number> = {}
    let minutesPlayed: number | undefined

    stats.forEach((statItem: { stat: { stat_id: string; value: string } }) => {
      const statId = statItem.stat.stat_id
      const value = statItem.stat.value
      const numValue = parseFloat(value)

      if (!isNaN(numValue)) {
        statsObject[statId] = numValue
        if (statId === '3') minutesPlayed = numValue
      }
    })

    // Save to database
    if (supabase && playerName) {
      const { error } = await supabase
        .from('player_game_logs')
        .upsert({
          player_key: playerKey,
          player_name: playerName,
          game_date: date,
          stats: statsObject,
          minutes_played: minutesPlayed || null,
          opponent: null,
          home_away: null,
          game_result: null
        }, {
          onConflict: 'player_key,game_date'
        })

      if (error) {
        console.error(`Error saving ${playerKey} ${date}:`, error)
        return { success: false, playerName, hasGame: true }
      }
    }

    return { success: true, playerName, hasGame: true }
  } catch (error) {
    return { success: false, playerName: '', hasGame: false }
  }
}

/**
 * Sync a single player (incremental - only missing dates)
 */
async function syncPlayer(
  playerKey: string,
  accessToken: string,
  daysToCheck: number = 30
): Promise<PlayerSyncResult> {
  const result: PlayerSyncResult = {
    playerKey,
    playerName: '',
    status: 'success',
    gamesAdded: 0,
    apiCalls: 0
  }

  try {
    // Get existing dates
    const existingDates = await getExistingDates(playerKey)

    // Generate dates to check (last N days)
    const today = new Date()
    const dates: string[] = []
    const currentDate = new Date(today)

    for (let i = 0; i < daysToCheck; i++) {
      if (currentDate < NBA_SEASON_START) break

      const dateStr = currentDate.toISOString().split('T')[0]

      // Only process if not in database
      if (!existingDates.has(dateStr)) {
        dates.push(dateStr)
      }

      currentDate.setDate(currentDate.getDate() - 1)
    }

    if (dates.length === 0) {
      result.status = 'skipped'
      return result
    }

    // Fetch missing dates
    for (const date of dates) {
      const fetchResult = await fetchAndSaveGameLog(playerKey, date, accessToken)
      result.apiCalls++

      if (fetchResult.playerName && !result.playerName) {
        result.playerName = fetchResult.playerName
      }

      if (fetchResult.success && fetchResult.hasGame) {
        result.gamesAdded++
      }

      // Rate limiting
      if (result.apiCalls < dates.length) {
        await new Promise(resolve => setTimeout(resolve, 150))
      }
    }

    return result
  } catch (error) {
    result.status = 'error'
    result.error = error instanceof Error ? error.message : 'Unknown error'
    return result
  }
}

/**
 * Batch sync all players in a league
 * GET /api/yahoo/batch-sync-league?leagueKey=xxx&batchSize=10&daysToCheck=30
 *
 * This endpoint syncs all players in a league incrementally.
 * Perfect for daily automated sync to keep data up-to-date.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in with Yahoo.' },
        { status: 401 }
      )
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured. Cannot perform batch sync.' },
        { status: 503 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const leagueKey = searchParams.get('leagueKey')
    const batchSize = parseInt(searchParams.get('batchSize') || '10')
    const daysToCheck = parseInt(searchParams.get('daysToCheck') || '30')

    if (!leagueKey) {
      return NextResponse.json(
        { error: 'leagueKey parameter is required' },
        { status: 400 }
      )
    }

    console.log(`=== Batch Sync League ${leagueKey} ===`)
    console.log(`Batch size: ${batchSize}`)
    console.log(`Days to check: ${daysToCheck}`)

    // Step 1: Get all players in league
    console.log('Step 1: Fetching league players...')
    const allPlayers = await getLeaguePlayers(leagueKey, session.accessToken)

    if (allPlayers.length === 0) {
      return NextResponse.json({
        error: 'No players found in league',
        leagueKey
      }, { status: 404 })
    }

    console.log(`Found ${allPlayers.length} players in league`)

    // Step 2: Limit to batch size
    const playersToSync = allPlayers.slice(0, batchSize)
    console.log(`Syncing batch of ${playersToSync.length} players...`)

    // Step 3: Sync each player
    const results: PlayerSyncResult[] = []
    let totalGamesAdded = 0
    let totalApiCalls = 0

    for (let i = 0; i < playersToSync.length; i++) {
      const playerKey = playersToSync[i]
      console.log(`[${i + 1}/${playersToSync.length}] Syncing ${playerKey}...`)

      const result = await syncPlayer(playerKey, session.accessToken, daysToCheck)
      results.push(result)

      totalGamesAdded += result.gamesAdded
      totalApiCalls += result.apiCalls

      console.log(`  → ${result.playerName || playerKey}: +${result.gamesAdded} games (${result.apiCalls} calls) [${result.status}]`)
    }

    const duration = Date.now() - startTime
    const remainingPlayers = allPlayers.length - playersToSync.length

    console.log(`=== Batch Complete ===`)
    console.log(`Duration: ${duration}ms`)
    console.log(`Players synced: ${playersToSync.length}/${allPlayers.length}`)
    console.log(`Games added: ${totalGamesAdded}`)
    console.log(`API calls: ${totalApiCalls}`)

    return NextResponse.json({
      leagueKey,
      status: remainingPlayers > 0 ? 'partial' : 'complete',
      message: remainingPlayers > 0
        ? `Batch complete. ${remainingPlayers} players remaining.`
        : 'All players synced!',
      summary: {
        totalPlayers: allPlayers.length,
        syncedPlayers: playersToSync.length,
        remainingPlayers,
        gamesAdded: totalGamesAdded,
        apiCallsMade: totalApiCalls,
        durationMs: duration
      },
      results: results.map(r => ({
        playerKey: r.playerKey,
        playerName: r.playerName || 'Unknown',
        status: r.status,
        gamesAdded: r.gamesAdded,
        apiCalls: r.apiCalls,
        error: r.error
      })),
      nextBatch: remainingPlayers > 0
        ? {
            url: `/api/yahoo/batch-sync-league?leagueKey=${leagueKey}&batchSize=${batchSize}&daysToCheck=${daysToCheck}`,
            remainingPlayers
          }
        : undefined
    })

  } catch (error: unknown) {
    console.error('Error in /api/yahoo/batch-sync-league:', error)
    const err = error as Error

    return NextResponse.json(
      { error: err.message || 'Failed to batch sync league' },
      { status: 500 }
    )
  }
}
