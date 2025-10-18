import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getUserLeagues } from '@/lib/yahoo/api'

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
    const season = searchParams.get('season') || undefined

    const leagues = await getUserLeagues(session.accessToken, season)

    return NextResponse.json({ leagues })
  } catch (error: any) {
    console.error('Error in /api/yahoo/leagues:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch leagues' },
      { status: 500 }
    )
  }
}
