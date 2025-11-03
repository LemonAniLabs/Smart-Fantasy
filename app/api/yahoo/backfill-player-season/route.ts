import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import axios from 'axios'
import { supabase } from '@/lib/supabase/client'

const YAHOO_FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'

// NBA season date ranges
const SEASONS: Record<string, { start: string; end: string }> = {
  '2025-26': { start: '2025-10-21', end: '2026-06-30' },
  '2024-25': { start: '2024-10-22', end: '2025-06-17' },
  '2023-24': { start: '2023-10-24', end: '2024-06-17' }
}

interface GameLog {
  date: string
  stats: Record<string, number>
  hasGame: boolean
  opponent?: string
  home_away?: 'home' | 'away'
  minutes_played?: number
  game_result?: 'W' | 'L' | 'T'
}

interface BackfillProgress {
  totalDates: number
  processedDates: number
  gamesFound: number
  gamesSaved: number
  apiCalls: number
  errors: number
  currentDate?: string
  status: 'processing' | 'completed' | 'error'
}

/**
 * Get existing dates from database
 */
async function getExistingDates(playerKey: string, startDate: string, endDate: string): Promise<Set<string>> {
  if (!supabase) {
    return new Set()
  }

  try {
    const { data, error } = await supabase
      .from('player_game_logs')
      .select('game_date')
      .eq('player_key', playerKey)
      .gte('game_date', startDate)
      .lte('game_date', endDate)

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

    return !error
  } catch (error) {
    return false
  }
}

/**
 * Fetch game log for a specific date
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

    const hasGame = stats.some((stat: { stat: { value: string } }) =>
      stat.stat.value !== '-' && stat.stat.value !== '0'
    )

    if (!hasGame) {
      return { gameLog: null, playerName }
    }

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

    return {
      gameLog: {
        date,
        stats: statsObject,
        hasGame: true,
        minutes_played: minutesPlayed,
      },
      playerName
    }
  } catch (error) {
    return { gameLog: null, playerName: '' }
  }
}

/**
 * Backfill historical data for an entire season
 * GET /api/yahoo/backfill-player-season?playerKey=xxx&season=2023-24&batchSize=50
 *
 * This endpoint fetches all game data for a player for an entire season.
 * Use this to populate historical data before starting incremental sync.
 *
 * IMPORTANT: This may take several minutes and make hundreds of API calls.
 * Use batch processing to avoid timeouts.
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
        { error: 'Database not configured. Cannot perform backfill.' },
        { status: 503 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const playerKey = searchParams.get('playerKey')
    const season = searchParams.get('season') || '2025-26'
    const batchSize = parseInt(searchParams.get('batchSize') || '50')

    if (!playerKey) {
      return NextResponse.json(
        { error: 'playerKey parameter is required' },
        { status: 400 }
      )
    }

    if (!SEASONS[season]) {
      return NextResponse.json(
        {
          error: `Invalid season. Available seasons: ${Object.keys(SEASONS).join(', ')}`,
        },
        { status: 400 }
      )
    }

    const seasonDates = SEASONS[season]
    const startDate = new Date(seasonDates.start)
    const endDate = new Date(seasonDates.end)

    // Don't query future dates
    const today = new Date()
    const actualEndDate = endDate > today ? today : endDate

    console.log(`=== Backfill Season ${season} for ${playerKey} ===`)
    console.log(`Date range: ${seasonDates.start} to ${actualEndDate.toISOString().split('T')[0]}`)
    console.log(`Batch size: ${batchSize}`)

    // Generate all dates in season
    const allDates: string[] = []
    const currentDate = new Date(startDate)

    while (currentDate <= actualEndDate) {
      const dateStr = currentDate.toISOString().split('T')[0]
      allDates.push(dateStr)
      currentDate.setDate(currentDate.getDate() + 1)
    }

    console.log(`Total dates in season: ${allDates.length}`)

    // Check existing dates
    const existingDates = await getExistingDates(playerKey, seasonDates.start, seasonDates.end)
    console.log(`Existing game logs: ${existingDates.size}`)

    // Find missing dates
    const missingDates = allDates.filter(date => !existingDates.has(date))
    console.log(`Missing dates: ${missingDates.length}`)

    if (missingDates.length === 0) {
      return NextResponse.json({
        playerKey,
        season,
        status: 'complete',
        message: 'Season data is already complete',
        totalGames: existingDates.size,
        newGames: 0,
        apiCallsMade: 0
      })
    }

    // Process in batches to avoid timeout
    const datesToProcess = missingDates.slice(0, batchSize)
    console.log(`Processing batch of ${datesToProcess.length} dates...`)

    const progress: BackfillProgress = {
      totalDates: missingDates.length,
      processedDates: 0,
      gamesFound: 0,
      gamesSaved: 0,
      apiCalls: 0,
      errors: 0,
      status: 'processing'
    }

    let playerName = ''

    for (const date of datesToProcess) {
      progress.currentDate = date
      progress.processedDates++

      const { gameLog, playerName: name } = await fetchGameLogForDate(
        playerKey,
        date,
        session.accessToken
      )

      progress.apiCalls++

      if (name && !playerName) {
        playerName = name
      }

      if (gameLog) {
        progress.gamesFound++

        const saved = await saveGameLog(playerKey, playerName, gameLog)
        if (saved) {
          progress.gamesSaved++
          console.log(`✓ ${date}: ${gameLog.minutes_played || 0} min`)
        } else {
          progress.errors++
          console.error(`✗ Failed to save ${date}`)
        }
      }

      // Rate limiting
      if (progress.processedDates < datesToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    progress.status = 'completed'

    const remainingDates = missingDates.length - datesToProcess.length
    const needsMoreBatches = remainingDates > 0

    console.log(`=== Batch Complete ===`)
    console.log(`Processed: ${progress.processedDates}/${missingDates.length}`)
    console.log(`Games found: ${progress.gamesFound}`)
    console.log(`Games saved: ${progress.gamesSaved}`)
    console.log(`Remaining: ${remainingDates}`)

    return NextResponse.json({
      playerKey,
      playerName,
      season,
      status: needsMoreBatches ? 'partial' : 'complete',
      message: needsMoreBatches
        ? `Batch complete. ${remainingDates} dates remaining. Call again to continue.`
        : 'Season backfill complete!',
      progress: {
        totalDates: missingDates.length,
        processedDates: progress.processedDates,
        remainingDates,
        percentComplete: Math.round((progress.processedDates / missingDates.length) * 100)
      },
      results: {
        existingGames: existingDates.size,
        newGames: progress.gamesSaved,
        apiCallsMade: progress.apiCalls,
        errors: progress.errors
      },
      nextBatch: needsMoreBatches
        ? {
            url: `/api/yahoo/backfill-player-season?playerKey=${playerKey}&season=${season}&batchSize=${batchSize}`,
            remainingDates
          }
        : undefined
    })

  } catch (error: unknown) {
    console.error('Error in /api/yahoo/backfill-player-season:', error)
    const err = error as Error

    return NextResponse.json(
      { error: err.message || 'Failed to backfill season data' },
      { status: 500 }
    )
  }
}
