import { NextRequest, NextResponse } from 'next/server'
import { yahooClient } from '@/lib/yahoo/client'

/**
 * Get players from Yahoo Fantasy API
 * GET /api/yahoo/players?gameKey=nba.g.xxx&position=PG&start=0&count=25
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const gameKey = searchParams.get('gameKey')
    const position = searchParams.get('position') || undefined
    const start = searchParams.get('start') ? parseInt(searchParams.get('start')!) : 0
    const count = searchParams.get('count') ? parseInt(searchParams.get('count')!) : 25

    // If no game key provided, get current season
    let finalGameKey = gameKey
    if (!finalGameKey) {
      finalGameKey = await yahooClient.getCurrentSeasonGameKey()
    }

    const players = await yahooClient.getPlayers(finalGameKey, {
      start,
      count,
      position,
    })

    return NextResponse.json({
      success: true,
      gameKey: finalGameKey,
      data: players,
    })
  } catch (error: any) {
    console.error('Error fetching Yahoo players:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch players',
      },
      { status: 500 }
    )
  }
}
