import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentMatchup } from '@/lib/yahoo/api'

/**
 * Get matchup for a team for a specific week or current week
 * GET /api/yahoo/matchup?teamKey=xxx&week=1 (optional week parameter)
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
    const weekParam = searchParams.get('week')
    const week = weekParam ? parseInt(weekParam) : undefined

    if (!teamKey) {
      return NextResponse.json(
        { error: 'teamKey parameter is required' },
        { status: 400 }
      )
    }

    const result = await getCurrentMatchup(session.accessToken, teamKey, week)

    return NextResponse.json({
      matchup: result?.matchup || null,
      week: result?.week || 1
    })
  } catch (error: unknown) {
    console.error('Error in /api/yahoo/matchup:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch matchup' },
      { status: 500 }
    )
  }
}
