import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import axios from 'axios'

const YAHOO_FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'

/**
 * Debug endpoint to see raw Yahoo API response
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in with Yahoo.' },
        { status: 401 }
      )
    }

    // Try different season values and URLs
    const tests = []

    // Test 1: 2024 season
    try {
      const url1 = `${YAHOO_FANTASY_API_BASE}/users;use_login=1/games;game_codes=nba;seasons=2024/leagues?format=json`
      const response1 = await axios.get(url1, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: 'application/json',
        },
      })
      tests.push({
        url: url1,
        success: true,
        data: response1.data,
      })
    } catch (error) {
      tests.push({
        url: 'season=2024',
        success: false,
        error: axios.isAxiosError(error) ? {
          status: error.response?.status,
          data: error.response?.data,
        } : String(error),
      })
    }

    // Test 2: Without season filter (all games)
    try {
      const url2 = `${YAHOO_FANTASY_API_BASE}/users;use_login=1/games;game_codes=nba/leagues?format=json`
      const response2 = await axios.get(url2, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: 'application/json',
        },
      })
      tests.push({
        url: url2,
        success: true,
        data: response2.data,
      })
    } catch (error) {
      tests.push({
        url: 'no season filter',
        success: false,
        error: axios.isAxiosError(error) ? {
          status: error.response?.status,
          data: error.response?.data,
        } : String(error),
      })
    }

    // Test 3: Just user games
    try {
      const url3 = `${YAHOO_FANTASY_API_BASE}/users;use_login=1/games?format=json`
      const response3 = await axios.get(url3, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: 'application/json',
        },
      })
      tests.push({
        url: url3,
        success: true,
        data: response3.data,
      })
    } catch (error) {
      tests.push({
        url: 'user games',
        success: false,
        error: axios.isAxiosError(error) ? {
          status: error.response?.status,
          data: error.response?.data,
        } : String(error),
      })
    }

    return NextResponse.json({
      sessionExists: true,
      hasAccessToken: !!session.accessToken,
      tests,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: String(error),
      },
      { status: 500 }
    )
  }
}
