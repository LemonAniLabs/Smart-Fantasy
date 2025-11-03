import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Fetch user's game leagues for NBA (game_key = nba)
    const url = 'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=nba/leagues?format=json'

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Yahoo API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch leagues', details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Parse the leagues from Yahoo's nested response format
    const users = data.fantasy_content?.users
    if (!users || users.count === 0) {
      return NextResponse.json({ leagues: [] })
    }

    // Extract leagues from the first user
    const user = users['0'].user
    const games = user[1]?.games

    if (!games || games.count === 0) {
      return NextResponse.json({ leagues: [] })
    }

    // Extract NBA game leagues
    const game = games['0']?.game
    const leagues = game[1]?.leagues

    if (!leagues || leagues.count === 0) {
      return NextResponse.json({ leagues: [] })
    }

    // Format leagues data
    const leagueList = []
    for (let i = 0; i < leagues.count; i++) {
      const league = leagues[i.toString()]?.league
      if (league && league[0]) {
        const leagueData = league[0]
        leagueList.push({
          league_key: leagueData.league_key,
          league_id: leagueData.league_id,
          name: leagueData.name,
          season: leagueData.season,
          num_teams: leagueData.num_teams,
          scoring_type: leagueData.scoring_type,
          league_type: leagueData.league_type
        })
      }
    }

    console.log(`Found ${leagueList.length} leagues:`)
    leagueList.forEach((league, i) => {
      console.log(`  [${i + 1}] ${league.name} (${league.league_key}) - ${league.num_teams} teams`)
    })

    return NextResponse.json({
      success: true,
      leagues: leagueList,
      count: leagueList.length
    })

  } catch (error: unknown) {
    console.error('Error fetching leagues:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 }
    )
  }
}
