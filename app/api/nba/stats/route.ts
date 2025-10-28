import { NextRequest, NextResponse } from 'next/server'
import { fetchPlayerStats } from '@/lib/nba/api'

// Cache player stats in memory (refreshes when server restarts)
const statsCache: Map<string, { data: unknown; timestamp: number }> = new Map()
const CACHE_DURATION = 1000 * 60 * 60 * 24 // 24 hours

/**
 * Get NBA player stats with optional time range filtering
 * GET /api/nba/stats?season=2025&range=last7Days
 *
 * Range options:
 * - (none): Full season stats
 * - last7Days: Last 7 days average
 * - last14Days: Last 14 days average
 * - last30Days: Last 30 days average
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const season = searchParams.get('season') || '2025'
    const range = searchParams.get('range') || 'season'

    // Create cache key that includes range
    const cacheKey = `${season}-${range}`

    // Check cache
    const cached = statsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Returning cached stats for ${cacheKey}`)
      return NextResponse.json({
        stats: cached.data,
        cached: true,
        range,
      })
    }

    // Fetch fresh data
    console.log(`Fetching fresh stats for ${cacheKey}`)
    const playerStatsMap = await fetchPlayerStats(season, range)

    // Convert Map to object for JSON response
    const statsObject: Record<string, unknown> = {}
    playerStatsMap.forEach((stats, name) => {
      statsObject[name] = stats
    })

    // Update cache
    statsCache.set(cacheKey, {
      data: statsObject,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      stats: statsObject,
      cached: false,
      count: playerStatsMap.size,
      range,
    })
  } catch (error: unknown) {
    console.error('Error in /api/nba/stats:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch NBA stats' },
      { status: 500 }
    )
  }
}
