import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import axios from 'axios'

const YAHOO_FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'

// 2024-25 NBA season started on October 22, 2024
const NBA_SEASON_START = new Date('2024-10-22')

interface GameLog {
  date: string
  stats: Record<string, number>
  hasGame: boolean
}

/**
 * Get player's game-by-game stats for the current season
 * GET /api/yahoo/player-season-games?playerKey=xxx&limit=10
 *
 * This endpoint fetches date-by-date stats from Yahoo Fantasy API
 * to build a complete game log for the season.
 *
 * Note: Only includes dates where the player had a game (non-empty stats)
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
    const playerKey = searchParams.get('playerKey')
    const limitParam = searchParams.get('limit') || '10' // Default: last 10 games

    if (!playerKey) {
      return NextResponse.json(
        { error: 'playerKey parameter is required' },
        { status: 400 }
      )
    }

    const limit = parseInt(limitParam)
    if (isNaN(limit) || limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: 'limit must be between 1 and 50' },
        { status: 400 }
      )
    }

    console.log(`Fetching last ${limit} games for player ${playerKey}`)

    // Get dates to check (from today backwards)
    const today = new Date()
    const datesToCheck: string[] = []
    const currentDate = new Date(today)

    // Go back up to 150 days to find {limit} games (NBA season is ~180 days)
    const maxDaysToCheck = Math.min(150, limit * 5) // Estimate: ~5 days per game

    for (let i = 0; i < maxDaysToCheck; i++) {
      if (currentDate < NBA_SEASON_START) break

      // Format as YYYY-MM-DD
      const dateStr = currentDate.toISOString().split('T')[0]
      datesToCheck.push(dateStr)

      // Go back one day
      currentDate.setDate(currentDate.getDate() - 1)
    }

    console.log(`Checking ${datesToCheck.length} dates from ${datesToCheck[datesToCheck.length - 1]} to ${datesToCheck[0]}`)

    // Fetch stats for each date
    const gameLogs: GameLog[] = []
    let requestCount = 0

    for (const date of datesToCheck) {
      // Stop if we've found enough games
      if (gameLogs.length >= limit) break

      try {
        const url = `${YAHOO_FANTASY_API_BASE}/player/${playerKey}/stats;type=date;date=${date}?format=json`

        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: 'application/json',
          },
        })

        requestCount++

        const playerData = response.data?.fantasy_content?.player
        if (!playerData || !Array.isArray(playerData) || playerData.length < 2) {
          continue
        }

        const playerStats = playerData[1]?.player_stats
        if (!playerStats || typeof playerStats !== 'object') {
          continue
        }

        const stats = playerStats.stats
        if (!stats || !Array.isArray(stats) || stats.length === 0) {
          continue
        }

        // Check if player had a game (stats should not all be "-")
        const hasGame = stats.some((stat: { stat: { value: string } }) =>
          stat.stat.value !== '-' && stat.stat.value !== '0'
        )

        if (!hasGame) {
          continue
        }

        // Convert stats array to object
        const statsObject: Record<string, number> = {}
        stats.forEach((statItem: { stat: { stat_id: string; value: string } }) => {
          const statId = statItem.stat.stat_id
          const value = statItem.stat.value

          // Convert to number if possible
          const numValue = parseFloat(value)
          if (!isNaN(numValue)) {
            statsObject[statId] = numValue
          }
        })

        gameLogs.push({
          date,
          stats: statsObject,
          hasGame: true,
        })

        console.log(`Found game on ${date} - ${Object.keys(statsObject).length} stats`)

      } catch (error) {
        console.error(`Error fetching stats for ${date}:`, error)
        // Continue to next date
      }

      // Add small delay to avoid rate limiting (200ms between requests)
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log(`Found ${gameLogs.length} games in ${requestCount} API requests`)

    return NextResponse.json({
      playerKey,
      gamesFound: gameLogs.length,
      requestsMade: requestCount,
      gameLogs,
    })

  } catch (error: unknown) {
    console.error('Error in /api/yahoo/player-season-games:', error)
    const err = error as Error & { status?: number }

    return NextResponse.json(
      { error: err.message || 'Failed to fetch player season games' },
      { status: 500 }
    )
  }
}
