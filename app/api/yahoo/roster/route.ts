import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getTeamRoster } from '@/lib/yahoo/api'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()

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

    const roster = await getTeamRoster(session.accessToken, teamKey)

    return NextResponse.json({ roster })
  } catch (error: any) {
    console.error('Error in /api/yahoo/roster:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch roster' },
      { status: 500 }
    )
  }
}
