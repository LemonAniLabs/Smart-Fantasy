import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRosterPlayersStats, getLeagueMetadata, getTeamRoster } from '@/lib/yahoo/api'

// Cache player stats in memory (refreshes when server restarts)
const statsCache: Map<string, { data: unknown; timestamp: number }> = new Map()
const CACHE_DURATION = 1000 * 60 * 30 // 30 minutes (shorter than NBA stats cache)

/**
 * Get roster players stats with time range filtering
 * GET /api/yahoo/league-players?myTeamKey=xxx&oppTeamKey=yyy&range=last7
 *
 * Range options:
 * - season: Full season stats (uses NBA API for better performance)
 * - last7: Last 1 week (7 days)
 * - last14: Last 2 weeks (14 days)
 * - last30: Last 4 weeks (30 days)
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
    const range = searchParams.get('range') || 'last7'

    if (!myTeamKey || !oppTeamKey) {
      return NextResponse.json(
        { error: 'myTeamKey and oppTeamKey parameters are required' },
        { status: 400 }
      )
    }

    // Map time range to number of weeks
    let numWeeks = 1
    if (range === 'last14') {
      numWeeks = 2
    } else if (range === 'last30') {
      numWeeks = 4
    } else if (range === 'season') {
      // For season stats, redirect to NBA API
      return NextResponse.json(
        {
          error: 'For season stats, use /api/nba/stats endpoint instead',
          redirect: '/api/nba/stats?season=2025'
        },
        { status: 400 }
      )
    }

    // Extract leagueKey from teamKey
    const leagueKey = myTeamKey.substring(0, myTeamKey.lastIndexOf('.t.'))

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

    // Get current week from league metadata
    console.log(`Fetching league metadata for ${leagueKey}`)
    const metadata = await getLeagueMetadata(session.accessToken, leagueKey)
    const currentWeek = parseInt(String(metadata?.current_week || '1'))
    console.log(`Current week: ${currentWeek}`)

    // Fetch both team rosters
    console.log(`Fetching rosters for ${myTeamKey} and ${oppTeamKey}`)
    const [myRoster, oppRoster] = await Promise.all([
      getTeamRoster(session.accessToken, myTeamKey),
      getTeamRoster(session.accessToken, oppTeamKey)
    ])

    // Combine both rosters
    const allPlayers = [...myRoster, ...oppRoster]
    console.log(`Total roster players: ${allPlayers.length}`)

    // Fetch fresh data from Yahoo API (only for roster players)
    console.log(`Fetching roster players stats for ${cacheKey} (week ${currentWeek}, ${numWeeks} weeks)`)
    const playerStatsMap = await getRosterPlayersStats(
      session.accessToken,
      allPlayers,
      currentWeek,
      numWeeks
    )

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
      currentWeek,
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
