import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTeamRoster, getLeagueMetadata } from '@/lib/yahoo/api'
import axios from 'axios'

const YAHOO_FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'

/**
 * Test endpoint to directly call Yahoo API and inspect raw responses
 * GET /api/yahoo/test?myTeamKey=xxx
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
    const myTeamKey = searchParams.get('myTeamKey')

    if (!myTeamKey) {
      return NextResponse.json(
        { error: 'myTeamKey parameter is required' },
        { status: 400 }
      )
    }

    // Extract leagueKey from teamKey
    const leagueKey = myTeamKey.substring(0, myTeamKey.lastIndexOf('.t.'))

    // Get current week from league metadata
    console.log('\n=== FETCHING LEAGUE METADATA ===')
    const metadata = await getLeagueMetadata(session.accessToken, leagueKey)
    const currentWeek = parseInt(String(metadata?.current_week || '1'))
    console.log(`Current week: ${currentWeek}`)

    // Get roster to pick a test player
    console.log('\n=== FETCHING TEAM ROSTER ===')
    const roster = await getTeamRoster(session.accessToken, myTeamKey)
    console.log(`Roster has ${roster.length} players`)

    if (roster.length === 0) {
      return NextResponse.json(
        { error: 'No players found in roster' },
        { status: 400 }
      )
    }

    // Pick first 3 players for testing
    const testPlayers = roster.slice(0, 3)
    const results = []

    for (const player of testPlayers) {
      console.log(`\n=== TESTING PLAYER: ${player.name.full} (${player.player_key}) ===`)

      const playerResults: Record<string, unknown> = {
        playerName: player.name.full,
        playerKey: player.player_key,
        weeks: {}
      }

      // Test current week and previous 2 weeks
      const weeksToTest = [currentWeek, currentWeek - 1, currentWeek - 2].filter(w => w >= 1)

      for (const week of weeksToTest) {
        console.log(`\n--- Testing Week ${week} ---`)
        const url = `${YAHOO_FANTASY_API_BASE}/player/${player.player_key}/stats;type=week;week=${week}?format=json`
        console.log(`URL: ${url}`)

        try {
          const response = await axios.get(url, {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              Accept: 'application/json',
            },
          })

          console.log(`Status: ${response.status}`)
          console.log(`Response data:`, JSON.stringify(response.data, null, 2))

          // Extract the stats from Yahoo's nested structure
          const playerData = response.data?.fantasy_content?.player
          const stats = playerData?.[1]?.player_stats?.stats

          playerResults.weeks[`week${week}`] = {
            status: response.status,
            hasData: !!stats && Array.isArray(stats) && stats.length > 0,
            statsCount: Array.isArray(stats) ? stats.length : 0,
            rawStats: stats || null,
            fullResponse: response.data
          }

        } catch (error) {
          console.error(`Error fetching week ${week}:`, error)
          playerResults.weeks[`week${week}`] = {
            status: axios.isAxiosError(error) ? error.response?.status : 'unknown',
            error: error instanceof Error ? error.message : String(error)
          }
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      results.push(playerResults)

      // Delay between players
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    return NextResponse.json({
      currentWeek,
      leagueKey,
      myTeamKey,
      testResults: results
    })

  } catch (error: unknown) {
    console.error('Error in /api/yahoo/test:', error)
    const err = error as Error & { status?: number }

    return NextResponse.json(
      { error: err.message || 'Test failed' },
      { status: 500 }
    )
  }
}
