import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserLeagues } from '@/lib/yahoo/api'

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
    const season = searchParams.get('season') || undefined

    const leagues = await getUserLeagues(session.accessToken, season)

    return NextResponse.json({ leagues })
  } catch (error: unknown) {
    console.error('Error in /api/yahoo/leagues:', error)
    const err = error as Error & { status?: number }
    const status = err.status === 401 ? 401 : 500
    return NextResponse.json(
      { error: err.message || 'Failed to fetch leagues' },
      { status }
    )
  }
}
