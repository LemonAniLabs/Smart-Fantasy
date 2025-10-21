import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLeagueSettings } from '@/lib/yahoo/api'

/**
 * Get league settings (scoring categories, roster positions, etc.)
 * GET /api/yahoo/settings?leagueKey=xxx
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

    const settings = await getLeagueSettings(session.accessToken, leagueKey)

    return NextResponse.json({ settings })
  } catch (error: unknown) {
    console.error('Error in /api/yahoo/settings:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch league settings' },
      { status: 500 }
    )
  }
}
