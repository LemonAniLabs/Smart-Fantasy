import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLeagueFreeAgents } from '@/lib/yahoo/api'

/**
 * Get Free Agents from Yahoo Fantasy
 * GET /api/yahoo/freeagents?leagueKey=nba.l.xxxxx&position=PG&count=50
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const leagueKey = searchParams.get('leagueKey')
    const position = searchParams.get('position') || '' // Filter by position
    const count = parseInt(searchParams.get('count') || '150') // Increase default from 50 to 150

    if (!leagueKey) {
      return NextResponse.json(
        { error: 'leagueKey is required' },
        { status: 400 }
      )
    }

    const freeAgents = await getLeagueFreeAgents(
      session.accessToken,
      leagueKey,
      position,
      count
    )

    return NextResponse.json({ freeAgents })
  } catch (error: unknown) {
    console.error('Error in /api/yahoo/freeagents:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch free agents' },
      { status: 500 }
    )
  }
}
