import { NextRequest, NextResponse } from 'next/server'
import { fetchPlayerStats } from '@/lib/nba/api'

// Cache player stats in memory (refreshes when server restarts)
let statsCache: Map<string, { data: unknown; timestamp: number }> = new Map()
const CACHE_DURATION = 1000 * 60 * 60 * 24 // 24 hours

/**
 * Get NBA player stats
 * GET /api/nba/stats?season=2025
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const season = searchParams.get('season') || '2025'

    // Check cache
    const cached = statsCache.get(season)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Returning cached stats for season ${season}`)
      return NextResponse.json({
        stats: cached.data,
        cached: true,
      })
    }

    // Fetch fresh data
    console.log(`Fetching fresh stats for season ${season}`)
    const playerStatsMap = await fetchPlayerStats(season)

    // Convert Map to object for JSON response
    const statsObject: Record<string, unknown> = {}
    playerStatsMap.forEach((stats, name) => {
      statsObject[name] = stats
    })

    // Update cache
    statsCache.set(season, {
      data: statsObject,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      stats: statsObject,
      cached: false,
      count: playerStatsMap.size,
    })
  } catch (error: unknown) {
    console.error('Error in /api/nba/stats:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch NBA stats' },
      { status: 500 }
    )
  }
}
