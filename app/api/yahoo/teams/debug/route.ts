import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import axios from 'axios'

const YAHOO_FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'

/**
 * Debug endpoint to see raw Yahoo Teams API response
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

    const url = `${YAHOO_FANTASY_API_BASE}/league/${leagueKey}/teams?format=json`

    console.log('Fetching teams from:', url)

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: 'application/json',
      },
    })

    return NextResponse.json({
      success: true,
      url,
      rawResponse: response.data,
    })
  } catch (error) {
    console.error('Error in teams debug endpoint:', error)
    return NextResponse.json(
      {
        success: false,
        error: axios.isAxiosError(error) ? {
          status: error.response?.status,
          data: error.response?.data,
        } : String(error),
      },
      { status: 500 }
    )
  }
}
