import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTeamRoster } from '@/lib/yahoo/api'
import { fetchPlayerStats, normalizePlayerName, type PlayerAverages } from '@/lib/nba/api'

// Cache player stats in memory (refreshes when server restarts)
const statsCache: Map<string, { data: unknown; timestamp: number }> = new Map()
const CACHE_DURATION = 1000 * 60 * 30 // 30 minutes (shorter than NBA stats cache)

/**
 * Get roster players stats with time range filtering
 * GET /api/yahoo/league-players?myTeamKey=xxx&oppTeamKey=yyy&range=last7
 *
 * Range options:
 * - season: Full season stats
 * - last7: Last 1 week (7 days) - Currently uses season stats (time range filtering pending)
 * - last14: Last 2 weeks (14 days) - Currently uses season stats (time range filtering pending)
 * - last30: Last 4 weeks (30 days) - Currently uses season stats (time range filtering pending)
 *
 * Note: Time range filtering currently uses season averages from NBA Stats API.
 * Yahoo API's weekly stats endpoint (type=week;week=N) doesn't return player_stats data.
 * Future enhancement: Implement date-based filtering using NBA game logs.
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
    const myTeamKey = searchParams.get('myTeamKey')
    const oppTeamKey = searchParams.get('oppTeamKey')
    const range = searchParams.get('range') || 'season'

    if (!myTeamKey || !oppTeamKey) {
      return NextResponse.json(
        { error: 'myTeamKey and oppTeamKey parameters are required' },
        { status: 400 }
      )
    }

    // Map time range to number of weeks (for logging/metadata only)
    let numWeeks = 1
    if (range === 'last14') {
      numWeeks = 2
    } else if (range === 'last30') {
      numWeeks = 4
    } else if (range === 'season') {
      numWeeks = 0 // Full season
    }

    // Create cache key
    const cacheKey = `${myTeamKey}-${oppTeamKey}-${range}`

    // Check cache
    const cached = statsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Returning cached roster players stats for ${cacheKey}`)
      return NextResponse.json({
        stats: cached.data,
        cached: true,
        range,
        numWeeks,
      })
    }

    console.log(`Fetching roster players stats for ${cacheKey} (range: ${range})`)

    // Fetch both team rosters
    console.log(`Fetching rosters for ${myTeamKey} and ${oppTeamKey}`)
    const [myRoster, oppRoster] = await Promise.all([
      getTeamRoster(session.accessToken, myTeamKey),
      getTeamRoster(session.accessToken, oppTeamKey)
    ])

    console.log(`My roster: ${myRoster.length} players`)
    console.log(`Opponent roster: ${oppRoster.length} players`)

    // Combine both rosters
    const allPlayers = [...myRoster, ...oppRoster]
    console.log(`Total roster players: ${allPlayers.length}`)

    // Log player names for debugging
    console.log(`Player names: ${allPlayers.slice(0, 5).map(p => p.name.full).join(', ')}...`)

    // Fetch stats from NBA API (season averages)
    // Note: Time range filtering not yet implemented - all ranges use season averages
    console.log(`Fetching NBA stats for season 2025 (${range})`)
    const nbaStatsMap = await fetchPlayerStats('2025', range)
    console.log(`NBA API returned ${nbaStatsMap.size} total players`)

    // Filter to only include roster players and convert to the expected format
    const playerStatsMap: Record<string, PlayerAverages> = {}
    let matchedCount = 0
    const unmatchedPlayers: string[] = []

    allPlayers.forEach(player => {
      const yahooName = player.name.full

      // Try exact match first
      let stats = nbaStatsMap.get(yahooName)

      // Try normalized match if exact match fails
      if (!stats) {
        const normalizedYahoo = normalizePlayerName(yahooName)
        for (const [nbaName, nbaStats] of nbaStatsMap.entries()) {
          if (normalizePlayerName(nbaName) === normalizedYahoo) {
            stats = nbaStats
            break
          }
        }
      }

      if (stats) {
        playerStatsMap[yahooName] = stats
        matchedCount++
      } else {
        unmatchedPlayers.push(yahooName)
      }
    })

    console.log(`Matched ${matchedCount}/${allPlayers.length} roster players with NBA stats`)
    if (unmatchedPlayers.length > 0) {
      console.log(`Unmatched players (${unmatchedPlayers.length}):`, unmatchedPlayers.slice(0, 10).join(', '))
    }
    console.log(`Sample player stats:`, Object.keys(playerStatsMap).slice(0, 3).map(name => ({
      name,
      ppg: playerStatsMap[name]?.ppg,
      gamesPlayed: playerStatsMap[name]?.gamesPlayed
    })))

    // Update cache
    statsCache.set(cacheKey, {
      data: playerStatsMap,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      stats: playerStatsMap,
      cached: false,
      count: Object.keys(playerStatsMap).length,
      range,
      numWeeks,
      source: 'nba-api',
      note: range !== 'season' ? 'Time range filtering not yet implemented - using season averages' : undefined,
    })
  } catch (error: unknown) {
    console.error('Error in /api/yahoo/league-players:', error)
    const err = error as Error & { status?: number }

    // Check for rate limiting error (Yahoo returns 999)
    if (err.message?.includes('999') || err.message?.includes('Request denied')) {
      return NextResponse.json(
        {
          error: 'Yahoo API rate limit exceeded. Please wait a moment and try again.',
          rateLimited: true
        },
        { status: 429 }
      )
    }

    const status = err.status === 401 ? 401 : 500
    return NextResponse.json(
      { error: err.message || 'Failed to fetch roster players stats' },
      { status }
    )
  }
}
