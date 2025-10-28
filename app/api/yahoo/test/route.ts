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

      const playerResults: {
        playerName: string
        playerKey: string
        weeks: Record<string, unknown>
      } = {
        playerName: player.name.full,
        playerKey: player.player_key,
        weeks: {}
      }

      // Test different API formats for week data
      const week = currentWeek

      // Test 1: Player stats with type=week
      console.log(`\n--- Test 1: Player Weekly Stats (type=week;week=${week}) ---`)
      const url1 = `${YAHOO_FANTASY_API_BASE}/player/${player.player_key}/stats;type=week;week=${week}?format=json`
      console.log(`URL: ${url1}`)

      try {
        const response = await axios.get(url1, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: 'application/json',
          },
        })

        const playerData = response.data?.fantasy_content?.player
        const stats = playerData?.[1]?.player_stats?.stats

        playerResults.weeks['test1_type_week'] = {
          description: 'Player stats with type=week;week=N',
          url: url1,
          status: response.status,
          hasData: !!stats && Array.isArray(stats) && stats.length > 0,
          statsCount: Array.isArray(stats) ? stats.length : 0,
          rawStats: stats || null,
          fullResponse: response.data
        }
      } catch (error) {
        playerResults.weeks['test1_type_week'] = {
          description: 'Player stats with type=week;week=N',
          url: url1,
          error: error instanceof Error ? error.message : String(error)
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200))

      // Test 2: Player stats with type=lastweek
      console.log(`\n--- Test 2: Player Stats (type=lastweek) ---`)
      const url2 = `${YAHOO_FANTASY_API_BASE}/player/${player.player_key}/stats;type=lastweek?format=json`
      console.log(`URL: ${url2}`)

      try {
        const response = await axios.get(url2, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: 'application/json',
          },
        })

        const playerData = response.data?.fantasy_content?.player
        const stats = playerData?.[1]?.player_stats?.stats

        playerResults.weeks['test2_lastweek'] = {
          description: 'Player stats with type=lastweek',
          url: url2,
          status: response.status,
          hasData: !!stats && Array.isArray(stats) && stats.length > 0,
          statsCount: Array.isArray(stats) ? stats.length : 0,
          rawStats: stats || null,
          fullResponse: response.data
        }
      } catch (error) {
        playerResults.weeks['test2_lastweek'] = {
          description: 'Player stats with type=lastweek',
          url: url2,
          error: error instanceof Error ? error.message : String(error)
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200))

      // Test 3: Player stats with type=season
      console.log(`\n--- Test 3: Player Stats (type=season) ---`)
      const url3 = `${YAHOO_FANTASY_API_BASE}/player/${player.player_key}/stats;type=season?format=json`
      console.log(`URL: ${url3}`)

      try {
        const response = await axios.get(url3, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: 'application/json',
          },
        })

        const playerData = response.data?.fantasy_content?.player
        const stats = playerData?.[1]?.player_stats?.stats

        playerResults.weeks['test3_season'] = {
          description: 'Player stats with type=season',
          url: url3,
          status: response.status,
          hasData: !!stats && Array.isArray(stats) && stats.length > 0,
          statsCount: Array.isArray(stats) ? stats.length : 0,
          rawStats: stats || null
        }
      } catch (error) {
        playerResults.weeks['test3_season'] = {
          description: 'Player stats with type=season',
          url: url3,
          error: error instanceof Error ? error.message : String(error)
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200))

      // Test 4: Player stats with type=date for today
      console.log(`\n--- Test 4: Player Stats (type=date) ---`)
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
      const url4 = `${YAHOO_FANTASY_API_BASE}/player/${player.player_key}/stats;type=date;date=${today}?format=json`
      console.log(`URL: ${url4}`)

      try {
        const response = await axios.get(url4, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: 'application/json',
          },
        })

        const playerData = response.data?.fantasy_content?.player
        const stats = playerData?.[1]?.player_stats?.stats

        playerResults.weeks['test4_date'] = {
          description: `Player stats with type=date;date=${today}`,
          url: url4,
          status: response.status,
          hasData: !!stats && Array.isArray(stats) && stats.length > 0,
          statsCount: Array.isArray(stats) ? stats.length : 0,
          rawStats: stats || null,
          fullResponse: response.data
        }
      } catch (error) {
        playerResults.weeks['test4_date'] = {
          description: `Player stats with type=date;date=${today}`,
          url: url4,
          error: error instanceof Error ? error.message : String(error)
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200))

      // Test 5: Try to get game logs
      console.log(`\n--- Test 5: Player Stats (stats resource) ---`)
      const url5 = `${YAHOO_FANTASY_API_BASE}/player/${player.player_key}/stats?format=json`
      console.log(`URL: ${url5}`)

      try {
        const response = await axios.get(url5, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: 'application/json',
          },
        })

        playerResults.weeks['test5_stats'] = {
          description: 'Player stats (default)',
          url: url5,
          status: response.status,
          fullResponse: response.data
        }
      } catch (error) {
        playerResults.weeks['test5_stats'] = {
          description: 'Player stats (default)',
          url: url5,
          error: error instanceof Error ? error.message : String(error)
        }
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
