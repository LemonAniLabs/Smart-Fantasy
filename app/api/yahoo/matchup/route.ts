import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentMatchup } from '@/lib/yahoo/api'

/**
 * Get current week's matchup for a team
 * GET /api/yahoo/matchup?teamKey=xxx
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

    if (!teamKey) {
      return NextResponse.json(
        { error: 'teamKey parameter is required' },
        { status: 400 }
      )
    }

    const matchup = await getCurrentMatchup(session.accessToken, teamKey)

    return NextResponse.json({ matchup })
  } catch (error: unknown) {
    console.error('Error in /api/yahoo/matchup:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch matchup' },
      { status: 500 }
    )
  }
}
