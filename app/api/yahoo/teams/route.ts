import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLeagueTeams } from '@/lib/yahoo/api'

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

    const teams = await getLeagueTeams(session.accessToken, leagueKey)

    return NextResponse.json({ teams })
  } catch (error: unknown) {
    console.error('Error in /api/yahoo/teams:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch teams' },
      { status: 500 }
    )
  }
}
