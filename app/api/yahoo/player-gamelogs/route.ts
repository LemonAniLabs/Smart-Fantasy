import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPlayerWeeklyStats } from '@/lib/yahoo/api'

/**
 * Get player's weekly stats (game logs accumulated for the week)
 * GET /api/yahoo/player-gamelogs?playerKey=xxx&week=1
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
    const weekParam = searchParams.get('week')

    if (!playerKey) {
      return NextResponse.json(
        { error: 'playerKey parameter is required' },
        { status: 400 }
      )
    }

    if (!weekParam) {
      return NextResponse.json(
        { error: 'week parameter is required' },
        { status: 400 }
      )
    }

    const week = parseInt(weekParam)
    if (isNaN(week) || week < 1) {
      return NextResponse.json(
        { error: 'week must be a positive integer' },
        { status: 400 }
      )
    }

    const stats = await getPlayerWeeklyStats(
      session.accessToken,
      playerKey,
      week
    )

    return NextResponse.json({
      playerKey,
      week,
      stats
    })
  } catch (error: unknown) {
    console.error('Error in /api/yahoo/player-gamelogs:', error)
    const err = error as Error & { status?: number }
    const status = err.status === 401 ? 401 : 500
    return NextResponse.json(
      { error: err.message || 'Failed to fetch player weekly stats' },
      { status }
    )
  }
}
