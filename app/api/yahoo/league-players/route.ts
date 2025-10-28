import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLeaguePlayersStats, getLeagueMetadata } from '@/lib/yahoo/api'

// Cache player stats in memory (refreshes when server restarts)
const statsCache: Map<string, { data: unknown; timestamp: number }> = new Map()
const CACHE_DURATION = 1000 * 60 * 30 // 30 minutes (shorter than NBA stats cache)

/**
 * Get all league players stats with time range filtering
 * GET /api/yahoo/league-players?leagueKey=xxx&range=last7Days
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
    const leagueKey = searchParams.get('leagueKey')
    const range = searchParams.get('range') || 'last7'

    if (!leagueKey) {
      return NextResponse.json(
        { error: 'leagueKey parameter is required' },
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

    // Create cache key
    const cacheKey = `${leagueKey}-${range}`

    // Check cache
    const cached = statsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Returning cached league players stats for ${cacheKey}`)
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

    // Fetch fresh data from Yahoo API
    console.log(`Fetching fresh league players stats for ${cacheKey} (week ${currentWeek}, ${numWeeks} weeks)`)
    const playerStatsMap = await getLeaguePlayersStats(
      session.accessToken,
      leagueKey,
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
    const status = err.status === 401 ? 401 : 500
    return NextResponse.json(
      { error: err.message || 'Failed to fetch league players stats' },
      { status }
    )
  }
}
