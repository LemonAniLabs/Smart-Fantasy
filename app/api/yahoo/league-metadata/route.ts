import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLeagueMetadata } from '@/lib/yahoo/api'

/**
 * Get league metadata including current week
 * GET /api/yahoo/league-metadata?leagueKey=xxx
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

    if (!leagueKey) {
      return NextResponse.json(
        { error: 'leagueKey parameter is required' },
        { status: 400 }
      )
    }

    const metadata = await getLeagueMetadata(session.accessToken, leagueKey)

    return NextResponse.json({ metadata })
  } catch (error: unknown) {
    console.error('Error in /api/yahoo/league-metadata:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch league metadata' },
      { status: 500 }
    )
  }
}
