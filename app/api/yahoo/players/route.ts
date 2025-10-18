import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import axios from 'axios'

const YAHOO_FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'

/**
 * Get players from Yahoo Fantasy API
 * GET /api/yahoo/players?gameKey=423&position=PG&start=0&count=25
 *
 * Requires user authentication via Yahoo OAuth
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
    const gameKey = searchParams.get('gameKey')
    const position = searchParams.get('position') || undefined
    const start = searchParams.get('start') ? parseInt(searchParams.get('start')!) : 0
    const count = searchParams.get('count') ? parseInt(searchParams.get('count')!) : 25

    let finalGameKey = gameKey
    if (!finalGameKey) {
      // Get current season game key if not provided
      const currentYear = new Date().getFullYear()
      const seasonResponse = await axios.get(
        `${YAHOO_FANTASY_API_BASE}/game/nba;seasons=${currentYear}`,
        {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Accept': 'application/json',
          },
        }
      )

      const gameData = seasonResponse.data as {
        fantasy_content?: {
          game?: Array<{ game_key?: string }>
        }
      }

      finalGameKey = gameData.fantasy_content?.game?.[0]?.game_key || `nba.l.${currentYear}`
    }

    // Build endpoint with parameters
    let endpoint = `/game/${finalGameKey}/players`
    const params: string[] = []
    if (start !== undefined) params.push(`start=${start}`)
    if (count !== undefined) params.push(`count=${count}`)
    if (position) params.push(`position=${position}`)

    if (params.length > 0) {
      endpoint += `;${params.join(';')}`
    }

    const response = await axios.get(
      `${YAHOO_FANTASY_API_BASE}${endpoint}`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/json',
        },
      }
    )

    return NextResponse.json({
      success: true,
      gameKey: finalGameKey,
      data: response.data,
    })
  } catch (error: unknown) {
    console.error('Error in /api/yahoo/players:', error)
    const err = error as { response?: { data?: unknown }; message?: string }
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to fetch players',
        details: err.response?.data || null,
      },
      { status: 500 }
    )
  }
}
