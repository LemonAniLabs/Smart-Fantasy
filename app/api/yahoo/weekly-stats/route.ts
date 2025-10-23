import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTeamWeeklyStats } from '@/lib/yahoo/api'

/**
 * Get team's weekly stats for a specific week
 * GET /api/yahoo/weekly-stats?teamKey=team_key&week=1
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
    const teamKey = searchParams.get('teamKey')
    const week = searchParams.get('week') || '1'

    if (!teamKey) {
      return NextResponse.json(
        { error: 'teamKey parameter is required' },
        { status: 400 }
      )
    }

    const stats = await getTeamWeeklyStats(
      session.accessToken,
      teamKey,
      parseInt(week)
    )

    return NextResponse.json({ stats })
  } catch (error: unknown) {
    console.error('Error in /api/yahoo/weekly-stats:', error)
    const err = error as Error & { status?: number }
    const status = err.status === 401 ? 401 : 500
    return NextResponse.json(
      { error: err.message || 'Failed to fetch weekly stats' },
      { status }
    )
  }
}
