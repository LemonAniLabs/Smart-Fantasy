/**
 * NBA Stats API Helper Functions
 * API Documentation: https://github.com/nprasad2077/nbaStats
 * No API key required
 */

const NBA_API_BASE = 'https://api.server.nbaapi.com/api'

export interface NBAPlayerStats {
  playerName: string
  team: string
  position: string
  games: number
  minutesPg: number
  fieldGoals: number
  fieldAttempts: number
  threeFg: number
  threeAttempts: number
  ft: number
  ftAttempts: number
  offensiveRb: number
  defensiveRb: number
  totalRb: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  personalFouls: number
  points: number
  season: number
}

export interface PlayerAverages {
  name: string
  team: string
  position: string
  gamesPlayed: number
  ppg: number
  rpg: number
  apg: number
  spg: number
  bpg: number
  tpg: number
  fgPct: number
  ftPct: number
  threepm: number
}

/**
 * Fetch player stats from NBA Stats API
 * Returns season averages for all players
 */
export async function fetchPlayerStats(season: string = '2025'): Promise<Map<string, PlayerAverages>> {
  const playerMap = new Map<string, PlayerAverages>()

  try {
    let page = 1
    const pageSize = 100
    let hasMore = true

    while (hasMore) {
      const url = `${NBA_API_BASE}/playertotals?season=${season}&page=${page}&pageSize=${pageSize}`

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        console.error(`NBA Stats API error: ${response.status}`)
        break
      }

      const result = await response.json()

      if (result?.data && Array.isArray(result.data)) {
        if (result.data.length === 0) {
          hasMore = false
        } else {
          // Process players from this page
          result.data.forEach((player: NBAPlayerStats) => {
            // Skip players with too few games or invalid teams
            if (!player.games || player.games < 5) return
            if (!player.team || /^\d+TM$/.test(player.team) || player.team === 'TOT' || player.team === 'UNK') return

            const gamesPlayed = player.games

            const averages: PlayerAverages = {
              name: player.playerName,
              team: player.team,
              position: player.position || 'F',
              gamesPlayed,
              ppg: player.points / gamesPlayed,
              rpg: player.totalRb / gamesPlayed,
              apg: player.assists / gamesPlayed,
              spg: player.steals / gamesPlayed,
              bpg: player.blocks / gamesPlayed,
              tpg: player.turnovers / gamesPlayed,
              fgPct: player.fieldAttempts > 0 ? player.fieldGoals / player.fieldAttempts : 0,
              ftPct: player.ftAttempts > 0 ? player.ft / player.ftAttempts : 0,
              threepm: player.threeFg / gamesPlayed,
            }

            // Handle duplicates: keep entry with more games (current team)
            const existing = playerMap.get(player.playerName)
            if (!existing || player.games > existing.gamesPlayed) {
              playerMap.set(player.playerName, averages)
            }
          })

          // Check if there are more pages
          if (result.pagination && page < result.pagination.pages) {
            page++
          } else {
            hasMore = false
          }
        }
      } else {
        hasMore = false
      }
    }

    console.log(`Fetched stats for ${playerMap.size} players from NBA Stats API`)
  } catch (error) {
    console.error('Error fetching NBA player stats:', error)
  }

  return playerMap
}

/**
 * Match Yahoo player name with NBA Stats player name
 * Returns normalized name for matching
 */
export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .replace(/'/g, '')
}

/**
 * Find player stats by name
 * Handles name variations and returns best match
 */
export function findPlayerStats(
  yahooPlayerName: string,
  statsMap: Map<string, PlayerAverages>
): PlayerAverages | null {
  // Try exact match first
  if (statsMap.has(yahooPlayerName)) {
    return statsMap.get(yahooPlayerName)!
  }

  // Try normalized match
  const normalizedYahoo = normalizePlayerName(yahooPlayerName)
  for (const [name, stats] of statsMap.entries()) {
    if (normalizePlayerName(name) === normalizedYahoo) {
      return stats
    }
  }

  // Try partial match (handles "LeBron James" vs "Lebron James" Jr.)
  for (const [name, stats] of statsMap.entries()) {
    const normalizedName = normalizePlayerName(name)
    if (normalizedName.includes(normalizedYahoo) || normalizedYahoo.includes(normalizedName)) {
      // Make sure it's a reasonably close match
      if (Math.abs(normalizedName.length - normalizedYahoo.length) < 5) {
        return stats
      }
    }
  }

  return null
}
