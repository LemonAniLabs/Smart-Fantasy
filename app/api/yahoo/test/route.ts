import { NextResponse } from 'next/server'
import { yahooClient } from '@/lib/yahoo/client'

/**
 * Test endpoint to verify Yahoo API connection
 * GET /api/yahoo/test
 */
export async function GET() {
  try {
    // Test 1: Get NBA games
    console.log('Testing Yahoo API connection...')
    const games = await yahooClient.getGames('nba')

    // Test 2: Get current season game key
    const gameKey = await yahooClient.getCurrentSeasonGameKey()

    return NextResponse.json({
      success: true,
      message: 'Yahoo API connection successful',
      data: {
        currentSeasonGameKey: gameKey,
        gamesResponse: games,
      },
    })
  } catch (error: unknown) {
    console.error('Yahoo API test failed:', error)
    const err = error as { response?: { data?: unknown }; message?: string }
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Unknown error',
        details: err.response?.data || null,
      },
      { status: 500 }
    )
  }
}
