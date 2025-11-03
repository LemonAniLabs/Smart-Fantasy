import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import axios from 'axios'
import { supabase } from '@/lib/supabase/client'

const YAHOO_FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'

// 2025-26 NBA season started on October 21, 2025
const NBA_SEASON_START = new Date('2025-10-21')

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
 * Get dates that already exist in database for a player
 */
async function getExistingDates(playerKey: string): Promise<Set<string>> {
  if (!supabase) {
    console.log('Supabase not configured, cannot check existing dates')
    return new Set()
  }

  try {
    const { data, error } = await supabase
      .from('player_game_logs')
      .select('game_date')
      .eq('player_key', playerKey)

    if (error) {
      console.error('Error fetching existing dates:', error)
      return new Set()
    }

    return new Set(data?.map(row => row.game_date) || [])
  } catch (error) {
    console.error('Error in getExistingDates:', error)
    return new Set()
  }
}

/**
 * Save game log to database
 */
async function saveGameLog(playerKey: string, playerName: string, gameLog: GameLog): Promise<boolean> {
  if (!supabase) {
    return false
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
      console.error('Error saving to database:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in saveGameLog:', error)
    return false
  }
}

/**
 * Fetch game log for a specific date from Yahoo API
 */
async function fetchGameLogForDate(
  playerKey: string,
  date: string,
  accessToken: string
): Promise<{ gameLog: GameLog | null; playerName: string }> {
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
      return { gameLog: null, playerName: '' }
    }

    const playerName = playerData[0]?.name?.full || ''
    const playerStats = playerData[1]?.player_stats

    if (!playerStats || typeof playerStats !== 'object') {
      return { gameLog: null, playerName }
    }

    const stats = playerStats.stats
    if (!stats || !Array.isArray(stats) || stats.length === 0) {
      return { gameLog: null, playerName }
    }

    // Check if player had a game
    const hasGame = stats.some((stat: { stat: { value: string } }) =>
      stat.stat.value !== '-' && stat.stat.value !== '0'
    )

    if (!hasGame) {
      return { gameLog: null, playerName }
    }

    // Convert stats array to object
    const statsObject: Record<string, number> = {}
    let minutesPlayed: number | undefined

    stats.forEach((statItem: { stat: { stat_id: string; value: string } }) => {
      const statId = statItem.stat.stat_id
      const value = statItem.stat.value
      const numValue = parseFloat(value)

      if (!isNaN(numValue)) {
        statsObject[statId] = numValue
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
    }

    return { gameLog, playerName }
  } catch (error) {
    console.error(`Error fetching data for ${date}:`, error)
    return { gameLog: null, playerName: '' }
  }
}

/**
 * Incremental sync endpoint for player game logs
 * GET /api/yahoo/sync-player-games?playerKey=xxx&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * This endpoint checks which dates are already in the database and only fetches missing ones.
 * Perfect for keeping data up-to-date without unnecessary API calls.
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

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured. Cannot perform sync.' },
        { status: 503 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const playerKey = searchParams.get('playerKey')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    if (!playerKey) {
      return NextResponse.json(
        { error: 'playerKey parameter is required' },
        { status: 400 }
      )
    }

    // Default date range: season start to today
    const startDate = startDateParam
      ? new Date(startDateParam)
      : NBA_SEASON_START

    const endDate = endDateParam
      ? new Date(endDateParam)
      : new Date()

    console.log(`=== Incremental Sync for ${playerKey} ===`)
    console.log(`Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`)

    // Step 1: Get existing dates from database
    console.log('Step 1: Checking existing data in database...')
    const existingDates = await getExistingDates(playerKey)
    console.log(`Found ${existingDates.size} existing game logs in database`)

    // Step 2: Generate all dates in range
    const allDates: string[] = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0]
      allDates.push(dateStr)
      currentDate.setDate(currentDate.getDate() + 1)
    }

    console.log(`Total dates in range: ${allDates.length}`)

    // Step 3: Find missing dates
    const missingDates = allDates.filter(date => !existingDates.has(date))
    console.log(`Missing dates: ${missingDates.length}`)

    if (missingDates.length === 0) {
      return NextResponse.json({
        playerKey,
        status: 'up_to_date',
        message: 'All data is already in database',
        existingGames: existingDates.size,
        newGames: 0,
        apiCallsMade: 0
      })
    }

    // Step 4: Fetch missing dates
    console.log(`Step 2: Fetching ${missingDates.length} missing dates...`)

    let playerName = ''
    let gamesAdded = 0
    let apiCalls = 0
    const errors: string[] = []

    for (const date of missingDates) {
      const { gameLog, playerName: name } = await fetchGameLogForDate(
        playerKey,
        date,
        session.accessToken
      )

      apiCalls++

      if (name && !playerName) {
        playerName = name
      }

      if (gameLog) {
        const saved = await saveGameLog(playerKey, playerName, gameLog)
        if (saved) {
          gamesAdded++
          console.log(`✓ Saved game for ${date} (${gameLog.minutes_played || 0} min)`)
        } else {
          errors.push(`Failed to save ${date}`)
        }
      }

      // Rate limiting: 200ms between requests
      if (apiCalls < missingDates.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    console.log(`=== Sync Complete ===`)
    console.log(`Games added: ${gamesAdded}`)
    console.log(`API calls made: ${apiCalls}`)
    console.log(`Errors: ${errors.length}`)

    return NextResponse.json({
      playerKey,
      playerName,
      status: 'success',
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      },
      existingGames: existingDates.size,
      newGames: gamesAdded,
      apiCallsMade: apiCalls,
      totalDatesChecked: missingDates.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error: unknown) {
    console.error('Error in /api/yahoo/sync-player-games:', error)
    const err = error as Error

    return NextResponse.json(
      { error: err.message || 'Failed to sync player games' },
      { status: 500 }
    )
  }
}
