/**
 * Yahoo Fantasy Sports API Helper Functions
 * Documentation: https://developer.yahoo.com/fantasysports/guide/
 */

import axios from 'axios'

const YAHOO_FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'

export interface YahooLeague {
  league_key: string
  league_id: string
  name: string
  season: string
  game_code: string
  num_teams: number
  scoring_type: string
  draft_status: string
}

export interface YahooTeam {
  team_key: string
  team_id: string
  name: string
  is_owned_by_current_login: boolean
  team_logos: unknown[]
  managers: unknown[]
}

export interface YahooPlayer {
  player_key: string
  player_id: string
  name: {
    full: string
    first: string
    last: string
  }
  position_type: string
  eligible_positions: string[]
  selected_position?: string
  status?: string // Injury status: 'INJ', 'GTD', 'O', 'DTD', etc.
  injury_note?: string
}

/**
 * Fetch user's fantasy basketball leagues
 */
export async function getUserLeagues(accessToken: string, season?: string): Promise<YahooLeague[]> {
  try {
    // Current NBA season is 2024-25, which Yahoo represents as "2025"
    const seasonYear = season || '2025'

    // Add format=json to get JSON response instead of XML
    const url = `${YAHOO_FANTASY_API_BASE}/users;use_login=1/games;game_codes=nba;seasons=${seasonYear}/leagues?format=json`

    console.log('Fetching leagues from:', url)

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    console.log('Yahoo API Response:', JSON.stringify(response.data, null, 2))

    // Parse the nested Yahoo response structure
    const users = response.data?.fantasy_content?.users
    if (!users || users.length === 0) {
      console.log('No users found in response')
      return []
    }

    const user = users[0]?.user
    if (!user || user.length < 2) {
      console.log('Invalid user structure')
      return []
    }

    const games = user[1]?.games
    if (!games || games.length === 0) {
      console.log('No games found for user')
      return []
    }

    const game = games[0]?.game
    if (!game || game.length < 2) {
      console.log('Invalid game structure')
      return []
    }

    const leaguesObj = game[1]?.leagues
    if (!leaguesObj || typeof leaguesObj !== 'object') {
      console.log('No leagues found in game')
      return []
    }

    // Extract league data from the response
    // leagues is an object like: {"0": {"league": [...]}, "count": 1}
    const leagueData: YahooLeague[] = []
    for (const key in leaguesObj) {
      if (key === 'count') continue // Skip the count property
      const leagueItem = leaguesObj[key]?.league
      if (leagueItem && Array.isArray(leagueItem) && leagueItem[0]) {
        leagueData.push(leagueItem[0] as YahooLeague)
      }
    }

    console.log('Parsed leagues:', leagueData)
    return leagueData
  } catch (error) {
    console.error('Error fetching Yahoo leagues:', error)
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data)
      console.error('Response status:', error.response?.status)
      // Preserve 401 status for proper error handling
      if (error.response?.status === 401) {
        const authError = new Error('Authentication failed. Please reconnect your Yahoo account.')
        ;(authError as Error & { status: number }).status = 401
        throw authError
      }
    }
    throw error
  }
}

/**
 * Fetch teams in a specific league
 */
export async function getLeagueTeams(accessToken: string, leagueKey: string): Promise<YahooTeam[]> {
  try {
    const url = `${YAHOO_FANTASY_API_BASE}/league/${leagueKey}/teams?format=json`

    console.log('Fetching teams from:', url)

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    console.log('Teams API Response:', JSON.stringify(response.data, null, 2))

    const league = response.data?.fantasy_content?.league
    if (!league || !Array.isArray(league) || league.length < 2) {
      console.log('Invalid league structure')
      return []
    }

    const teamsObj = league[1]?.teams
    if (!teamsObj || typeof teamsObj !== 'object') {
      console.log('No teams found in league')
      return []
    }

    // teams is an object like: {"0": {"team": [...]}, "count": 14}
    const teamData: YahooTeam[] = []
    for (const key in teamsObj) {
      if (key === 'count') continue
      const teamItem = teamsObj[key]?.team
      if (teamItem && Array.isArray(teamItem)) {
        // Yahoo API returns team as array where:
        // team[0] is array of property objects OR a single object with all properties
        // team[1] contains nested data (managers, etc.)
        let teamInfo: Partial<YahooTeam> & Record<string, unknown> = {}

        if (Array.isArray(teamItem[0])) {
          // team[0] is an array of individual property objects - merge them
          for (const prop of teamItem[0]) {
            if (typeof prop === 'object' && prop !== null) {
              teamInfo = { ...teamInfo, ...prop }
            }
          }
        } else if (typeof teamItem[0] === 'object') {
          // team[0] is already a single object with all properties
          teamInfo = teamItem[0] as Partial<YahooTeam> & Record<string, unknown>
        }

        // Convert numeric is_owned_by_current_login (0/1) to boolean
        if ('is_owned_by_current_login' in teamInfo) {
          const ownedValue = teamInfo.is_owned_by_current_login as unknown
          teamInfo.is_owned_by_current_login = ownedValue === 1 || ownedValue === true
        }

        if (teamInfo.team_key) {
          teamData.push(teamInfo as YahooTeam)
        }
      }
    }

    console.log('Parsed teams:', teamData)
    return teamData
  } catch (error) {
    console.error('Error fetching league teams:', error)
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data)
      if (error.response?.status === 401) {
        const authError = new Error('Authentication failed. Please reconnect your Yahoo account.')
        ;(authError as Error & { status: number }).status = 401
        throw authError
      }
    }
    throw error
  }
}

/**
 * Fetch roster for a specific team
 */
export async function getTeamRoster(accessToken: string, teamKey: string): Promise<YahooPlayer[]> {
  try {
    const url = `${YAHOO_FANTASY_API_BASE}/team/${teamKey}/roster?format=json`

    console.log('Fetching roster from:', url)

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    console.log('Roster API Response:', JSON.stringify(response.data, null, 2))

    const team = response.data?.fantasy_content?.team
    if (!team || !Array.isArray(team) || team.length < 2) {
      console.log('Invalid team structure')
      return []
    }

    const rosterObj = team[1]?.roster
    if (!rosterObj || typeof rosterObj !== 'object') {
      console.log('No roster found')
      return []
    }

    // roster can be either an object with "0" key or directly have the data
    // Example: {"0": {"players": {...}}} or {"players": {...}}
    const rosterData = rosterObj['0'] || rosterObj[0] || rosterObj
    if (!rosterData) {
      console.log('No roster data found')
      return []
    }

    const playersObj = rosterData.players
    if (!playersObj || typeof playersObj !== 'object') {
      console.log('No players found in roster')
      return []
    }

    // players is an object like: {"0": {"player": [...]}, "count": 13}
    const playerData: YahooPlayer[] = []
    for (const key in playersObj) {
      if (key === 'count') continue
      const playerItem = playersObj[key]?.player
      if (playerItem && Array.isArray(playerItem)) {
        // Yahoo API returns player as array where:
        // player[0] is array of property objects OR a single object with all properties
        // player[1] contains nested data (stats, etc.)
        let playerInfo: Partial<YahooPlayer> & Record<string, unknown> = {}

        if (Array.isArray(playerItem[0])) {
          // player[0] is an array of individual property objects - merge them
          for (const prop of playerItem[0]) {
            if (typeof prop === 'object' && prop !== null) {
              playerInfo = { ...playerInfo, ...prop }
            }
          }
        } else if (typeof playerItem[0] === 'object') {
          // player[0] is already a single object with all properties
          playerInfo = playerItem[0] as Partial<YahooPlayer> & Record<string, unknown>
        }

        // Process eligible_positions from object array to string array
        // Example: [{"position": "PG"}, {"position": "SG"}] => ["PG", "SG"]
        if (playerInfo.eligible_positions && Array.isArray(playerInfo.eligible_positions)) {
          playerInfo.eligible_positions = playerInfo.eligible_positions.map((pos: unknown) => {
            if (typeof pos === 'object' && pos !== null && 'position' in pos) {
              return (pos as { position: string }).position
            }
            return typeof pos === 'string' ? pos : ''
          }).filter(Boolean)
        }

        // Process selected_position from playerItem[1]
        // Example: [{"coverage_type": "date"}, {"position": "PG"}, {"is_flex": 0}]
        if (playerItem[1]?.selected_position && Array.isArray(playerItem[1].selected_position)) {
          const selectedPosArray = playerItem[1].selected_position
          const posObj = selectedPosArray.find((item: unknown) =>
            typeof item === 'object' && item !== null && 'position' in item
          )
          if (posObj && 'position' in posObj) {
            playerInfo.selected_position = (posObj as { position: string }).position
          }
        }

        // Ensure injury status fields are present (even if empty)
        // Yahoo API includes 'status' and 'injury_note' in player[0]
        if (!playerInfo.status) {
          playerInfo.status = undefined
        }
        if (!playerInfo.injury_note) {
          playerInfo.injury_note = undefined
        }

        // Log player with injury status for debugging
        if (playerInfo.status && playerInfo.status !== 'Healthy') {
          console.log(`Player ${playerInfo.name?.full} has injury status: ${playerInfo.status}`,
            playerInfo.injury_note ? `- ${playerInfo.injury_note}` : '')
        }

        if (playerInfo.player_key) {
          playerData.push(playerInfo as YahooPlayer)
        }
      }
    }

    console.log('Parsed players:', playerData)
    return playerData
  } catch (error) {
    console.error('Error fetching team roster:', error)
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data)
      if (error.response?.status === 401) {
        const authError = new Error('Authentication failed. Please reconnect your Yahoo account.')
        ;(authError as Error & { status: number }).status = 401
        throw authError
      }
    }
    throw error
  }
}

/**
 * Fetch league settings (categories, scoring type, etc.)
 */
export async function getLeagueSettings(accessToken: string, leagueKey: string) {
  try {
    const url = `${YAHOO_FANTASY_API_BASE}/league/${leagueKey}/settings?format=json`

    console.log('Fetching league settings from:', url)

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    console.log('League settings response:', JSON.stringify(response.data, null, 2))

    return response.data.fantasy_content?.league?.[1]?.settings || {}
  } catch (error) {
    console.error('Error fetching league settings:', error)
    throw error
  }
}

/**
 * Fetch league metadata including current week
 */
export async function getLeagueMetadata(accessToken: string, leagueKey: string) {
  try {
    const url = `${YAHOO_FANTASY_API_BASE}/league/${leagueKey}/metadata?format=json`

    console.log('Fetching league metadata from:', url)

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    console.log('League metadata response:', JSON.stringify(response.data, null, 2))

    const league = response.data?.fantasy_content?.league
    if (!league || !Array.isArray(league) || league.length < 1) {
      console.log('Invalid league structure')
      return null
    }

    // league[0] contains league info including current_week
    const leagueInfo = league[0] as Record<string, unknown>
    return leagueInfo
  } catch (error) {
    console.error('Error fetching league metadata:', error)
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data)
    }
    throw error
  }
}

/**
 * Fetch matchup for a team for a specific week (or current week if not specified)
 */
export async function getCurrentMatchup(accessToken: string, teamKey: string, week?: number) {
  try {
    // Get matchup for specific week or current week
    const weekParam = week ? `;weeks=${week}` : ';current'
    const url = `${YAHOO_FANTASY_API_BASE}/team/${teamKey}/matchups${weekParam}?format=json`

    console.log('Fetching matchup from:', url)

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    console.log('Matchup response:', JSON.stringify(response.data, null, 2))

    const team = response.data?.fantasy_content?.team
    if (!team || !Array.isArray(team) || team.length < 2) {
      console.log('Invalid team structure')
      return null
    }

    const matchupsObj = team[1]?.matchups
    if (!matchupsObj || typeof matchupsObj !== 'object') {
      console.log('No matchups found')
      return null
    }

    // Get first matchup
    const matchupData = matchupsObj['0']?.matchup || matchupsObj[0]?.matchup
    if (!matchupData) {
      console.log('No matchup data found')
      return null
    }

    // Extract week number from matchup data
    let weekNumber = week
    if (!weekNumber && matchupData[0]) {
      weekNumber = parseInt(String(matchupData[0].week || '1'))
    }

    return { matchup: matchupData, week: weekNumber }
  } catch (error) {
    console.error('Error fetching matchup:', error)
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data)
    }
    throw error
  }
}

/**
 * Fetch available players (free agents)
 */
export async function getAvailablePlayers(
  accessToken: string,
  leagueKey: string,
  position?: string,
  start?: number,
  count?: number
) {
  try {
    let url = `${YAHOO_FANTASY_API_BASE}/league/${leagueKey}/players;status=A;sort=AR` // A = Available, sort by Average Rank

    if (position) {
      url += `;position=${position}`
    }
    if (start !== undefined) {
      url += `;start=${start}`
    }
    if (count !== undefined) {
      url += `;count=${count}`
    }

    url += '?format=json'

    console.log('Fetching free agents from:', url)

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    console.log('Free agents response:', JSON.stringify(response.data, null, 2))

    const league = response.data?.fantasy_content?.league
    if (!league || !Array.isArray(league) || league.length < 2) {
      console.log('Invalid league structure')
      return []
    }

    const playersObj = league[1]?.players
    if (!playersObj || typeof playersObj !== 'object') {
      console.log('No players found')
      return []
    }

    // players is an object like: {"0": {"player": [...]}, "count": 50}
    const playerData: YahooPlayer[] = []
    for (const key in playersObj) {
      if (key === 'count') continue
      const playerItem = playersObj[key]?.player
      if (playerItem && Array.isArray(playerItem)) {
        let playerInfo: Partial<YahooPlayer> & Record<string, unknown> = {}

        if (Array.isArray(playerItem[0])) {
          for (const prop of playerItem[0]) {
            if (typeof prop === 'object' && prop !== null) {
              playerInfo = { ...playerInfo, ...prop }
            }
          }
        } else if (typeof playerItem[0] === 'object') {
          playerInfo = playerItem[0] as Partial<YahooPlayer> & Record<string, unknown>
        }

        // Process eligible_positions
        if (playerInfo.eligible_positions && Array.isArray(playerInfo.eligible_positions)) {
          playerInfo.eligible_positions = playerInfo.eligible_positions.map((pos: unknown) => {
            if (typeof pos === 'object' && pos !== null && 'position' in pos) {
              return (pos as { position: string }).position
            }
            return typeof pos === 'string' ? pos : ''
          }).filter(Boolean)
        }

        if (playerInfo.player_key) {
          playerData.push(playerInfo as YahooPlayer)
        }
      }
    }

    console.log('Parsed free agents:', playerData.length)
    return playerData
  } catch (error) {
    console.error('Error fetching available players:', error)
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data)
    }
    throw error
  }
}

/**
 * Fetch league free agents (wrapper for getAvailablePlayers with pagination)
 * Yahoo API limits each request to 25 results, so we need to make multiple requests
 */
export async function getLeagueFreeAgents(
  accessToken: string,
  leagueKey: string,
  position: string = '',
  count: number = 150
): Promise<YahooPlayer[]> {
  const allPlayers: YahooPlayer[] = []
  const batchSize = 25 // Yahoo API limit per request
  const numBatches = Math.ceil(count / batchSize)

  console.log(`Fetching ${count} free agents in ${numBatches} batches of ${batchSize}`)

  for (let i = 0; i < numBatches; i++) {
    const start = i * batchSize
    const batchCount = Math.min(batchSize, count - start)

    console.log(`Fetching batch ${i + 1}/${numBatches}: start=${start}, count=${batchCount}`)

    try {
      const players = await getAvailablePlayers(
        accessToken,
        leagueKey,
        position || undefined,
        start,
        batchCount
      )

      if (players.length === 0) {
        console.log(`No more players available at start=${start}, stopping pagination`)
        break // No more players available
      }

      allPlayers.push(...players)

      // If we got fewer players than requested, we've reached the end
      if (players.length < batchCount) {
        console.log(`Received ${players.length} players (less than ${batchCount}), stopping pagination`)
        break
      }
    } catch (error) {
      console.error(`Error fetching batch ${i + 1}:`, error)
      // Continue with what we have so far
      break
    }
  }

  console.log(`Total free agents fetched: ${allPlayers.length}`)
  return allPlayers
}

/**
 * Fetch all league players (both taken and available) for analysis
 * Yahoo API limits to 25 players per request, so we paginate
 */
export async function getAllLeaguePlayers(
  accessToken: string,
  leagueKey: string,
  maxAvailable: number = 100
): Promise<YahooPlayer[]> {
  const allPlayers: YahooPlayer[] = []

  // Fetch all taken players (on rosters)
  console.log('Fetching taken players (status=T)...')
  const takenPlayers = await fetchPlayersByStatus(accessToken, leagueKey, 'T', 500)
  allPlayers.push(...takenPlayers)
  console.log(`Fetched ${takenPlayers.length} taken players`)

  // Fetch top available players (free agents)
  console.log(`Fetching top ${maxAvailable} available players (status=A)...`)
  const availablePlayers = await fetchPlayersByStatus(accessToken, leagueKey, 'A', maxAvailable)
  allPlayers.push(...availablePlayers)
  console.log(`Fetched ${availablePlayers.length} available players`)

  console.log(`Total players fetched: ${allPlayers.length}`)
  return allPlayers
}

/**
 * Helper function to fetch players by status with pagination
 */
async function fetchPlayersByStatus(
  accessToken: string,
  leagueKey: string,
  status: string,
  maxCount: number
): Promise<YahooPlayer[]> {
  const allPlayers: YahooPlayer[] = []
  const batchSize = 25 // Yahoo API limit per request
  const numBatches = Math.ceil(maxCount / batchSize)

  for (let i = 0; i < numBatches; i++) {
    const start = i * batchSize
    const batchCount = Math.min(batchSize, maxCount - start)

    try {
      const url = `${YAHOO_FANTASY_API_BASE}/league/${leagueKey}/players;status=${status};start=${start};count=${batchCount}?format=json`

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      })

      const league = response.data?.fantasy_content?.league
      if (!league || !Array.isArray(league) || league.length < 2) {
        break
      }

      const playersObj = league[1]?.players
      if (!playersObj || typeof playersObj !== 'object') {
        break
      }

      const batchPlayers: YahooPlayer[] = []
      for (const key in playersObj) {
        if (key === 'count') continue
        const playerItem = playersObj[key]?.player
        if (playerItem && Array.isArray(playerItem)) {
          let playerInfo: Partial<YahooPlayer> & Record<string, unknown> = {}

          if (Array.isArray(playerItem[0])) {
            for (const prop of playerItem[0]) {
              if (typeof prop === 'object' && prop !== null) {
                playerInfo = { ...playerInfo, ...prop }
              }
            }
          } else if (typeof playerItem[0] === 'object') {
            playerInfo = playerItem[0] as Partial<YahooPlayer> & Record<string, unknown>
          }

          // Process eligible_positions
          if (playerInfo.eligible_positions && Array.isArray(playerInfo.eligible_positions)) {
            playerInfo.eligible_positions = playerInfo.eligible_positions.map((pos: unknown) => {
              if (typeof pos === 'object' && pos !== null && 'position' in pos) {
                return (pos as { position: string }).position
              }
              return typeof pos === 'string' ? pos : ''
            }).filter(Boolean)
          }

          if (playerInfo.player_key) {
            batchPlayers.push(playerInfo as YahooPlayer)
          }
        }
      }

      if (batchPlayers.length === 0) {
        break
      }

      allPlayers.push(...batchPlayers)

      if (batchPlayers.length < batchCount) {
        break
      }
    } catch (error) {
      console.error(`Error fetching ${status} players batch ${i + 1}:`, error)
      break
    }
  }

  return allPlayers
}

/**
 * Aggregate player stats across multiple weeks
 * Returns stats in format compatible with NBA API (PlayerAverages)
 */
export async function getPlayerMultiWeekStats(
  accessToken: string,
  playerKey: string,
  playerName: string,
  currentWeek: number,
  numWeeks: number
): Promise<{
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
  fgm: number
  fga: number
  ftm: number
  fta: number
  oreb: number
  dreb: number
  atoratio: number
} | null> {
  const weeklyStatsArray: Record<string, number>[] = []

  // Fetch stats for the last N weeks
  for (let i = 0; i < numWeeks; i++) {
    const weekNum = currentWeek - i
    if (weekNum < 1) break

    try {
      const stats = await getPlayerWeeklyStats(accessToken, playerKey, weekNum)
      if (stats && Object.keys(stats).length > 0) {
        weeklyStatsArray.push(stats)
      }
    } catch (error) {
      console.warn(`Failed to fetch week ${weekNum} stats for ${playerName}:`, error)
    }
  }

  // If no stats found, return null
  if (weeklyStatsArray.length === 0) {
    return null
  }

  // Aggregate stats
  const aggregated = {
    name: playerName,
    team: '',
    position: '',
    gamesPlayed: weeklyStatsArray.length,
    ppg: 0,
    rpg: 0,
    apg: 0,
    spg: 0,
    bpg: 0,
    tpg: 0,
    fgPct: 0,
    ftPct: 0,
    threepm: 0,
    fgm: 0,
    fga: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
    atoratio: 0,
  }

  let totalFGM = 0
  let totalFGA = 0
  let totalFTM = 0
  let totalFTA = 0

  weeklyStatsArray.forEach(stats => {
    aggregated.ppg += stats['PTS'] || 0
    aggregated.rpg += stats['REB'] || 0
    aggregated.apg += stats['AST'] || 0
    aggregated.spg += stats['ST'] || 0
    aggregated.bpg += stats['BLK'] || 0
    aggregated.tpg += stats['TO'] || 0
    aggregated.threepm += stats['3PTM'] || 0
    totalFGM += stats['FGM'] || 0
    totalFGA += stats['FGA'] || 0
    totalFTM += stats['FTM'] || 0
    totalFTA += stats['FTA'] || 0
    aggregated.oreb += stats['OREB'] || 0
  })

  // Calculate averages
  const weeks = weeklyStatsArray.length
  aggregated.ppg /= weeks
  aggregated.rpg /= weeks
  aggregated.apg /= weeks
  aggregated.spg /= weeks
  aggregated.bpg /= weeks
  aggregated.tpg /= weeks
  aggregated.threepm /= weeks
  aggregated.oreb /= weeks

  // Calculate percentages from totals
  aggregated.fgPct = totalFGA > 0 ? totalFGM / totalFGA : 0
  aggregated.ftPct = totalFTA > 0 ? totalFTM / totalFTA : 0
  aggregated.fgm = totalFGM / weeks
  aggregated.fga = totalFGA / weeks
  aggregated.ftm = totalFTM / weeks
  aggregated.fta = totalFTA / weeks
  aggregated.dreb = aggregated.rpg - aggregated.oreb
  aggregated.atoratio = aggregated.tpg > 0 ? aggregated.apg / aggregated.tpg : aggregated.apg

  return aggregated
}

/**
 * Fetch all league players with their stats for a specific time range
 * Returns stats in format compatible with NBA API for easy integration
 */
export async function getLeaguePlayersStats(
  accessToken: string,
  leagueKey: string,
  currentWeek: number,
  numWeeks: number = 1,
  maxAvailablePlayers: number = 100
): Promise<Record<string, {
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
  fgm: number
  fga: number
  ftm: number
  fta: number
  oreb: number
  dreb: number
  atoratio: number
}>> {
  console.log(`Fetching league players stats: currentWeek=${currentWeek}, numWeeks=${numWeeks}`)

  // Fetch all league players
  const players = await getAllLeaguePlayers(accessToken, leagueKey, maxAvailablePlayers)
  console.log(`Fetched ${players.length} total players from league`)

  // Fetch stats for each player
  const playerStatsMap: Record<string, {
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
    fgm: number
    fga: number
    ftm: number
    fta: number
    oreb: number
    dreb: number
    atoratio: number
  }> = {}

  // Process players in batches to avoid overwhelming the API
  const batchSize = 10
  for (let i = 0; i < players.length; i += batchSize) {
    const batch = players.slice(i, i + batchSize)

    const batchPromises = batch.map(async (player) => {
      try {
        const stats = await getPlayerMultiWeekStats(
          accessToken,
          player.player_key,
          player.name.full,
          currentWeek,
          numWeeks
        )

        if (stats) {
          playerStatsMap[player.name.full] = stats
        }
      } catch (error) {
        console.warn(`Failed to fetch stats for ${player.name.full}:`, error)
      }
    })

    await Promise.all(batchPromises)

    console.log(`Processed ${Math.min(i + batchSize, players.length)}/${players.length} players`)
  }

  console.log(`Successfully fetched stats for ${Object.keys(playerStatsMap).length} players`)
  return playerStatsMap
}

/**
 * Game log entry for a player
 */
export interface PlayerGameLog {
  date: string
  opponent: string
  stats: Record<string, number>
}

/**
 * Fetch player's stats for a specific week
 * Returns the player's accumulated stats for that week from Yahoo API
 */
export async function getPlayerWeeklyStats(
  accessToken: string,
  playerKey: string,
  week: number
): Promise<Record<string, number>> {
  try {
    const url = `${YAHOO_FANTASY_API_BASE}/player/${playerKey}/stats;type=week;week=${week}?format=json`

    console.log('Fetching player weekly stats from:', url)

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    console.log('Player weekly stats response:', JSON.stringify(response.data, null, 2))

    const player = response.data?.fantasy_content?.player
    if (!player || !Array.isArray(player) || player.length < 2) {
      console.log('Invalid player structure')
      return {}
    }

    // player[1] contains player_stats
    const playerStatsData = player[1]?.player_stats
    if (!playerStatsData || typeof playerStatsData !== 'object') {
      console.log('No player_stats found')
      return {}
    }

    // Parse stats
    const statsData = playerStatsData[1] || playerStatsData['1'] || playerStatsData
    const statsObj = statsData?.stats

    if (!statsObj || typeof statsObj !== 'object') {
      console.log('No stats object found')
      return {}
    }

    const stats: Record<string, number> = {}

    // Map stat IDs to readable names
    const statIdMap: Record<string, string> = {
      '5': 'FGM',   // Field Goals Made
      '8': 'FGA',   // Field Goals Attempted
      '9': 'FG%',   // Field Goal Percentage
      '6': 'FTM',   // Free Throws Made
      '11': 'FTA',  // Free Throws Attempted
      '10': 'FT%',  // Free Throw Percentage
      '1': '3PTM',  // 3-pointers Made
      '12': 'PTS',  // Points
      '15': 'OREB', // Offensive Rebounds
      '16': 'REB',  // Total Rebounds
      '17': 'AST',  // Assists
      '18': 'ST',   // Steals
      '19': 'BLK',  // Blocks
      '20': 'TO',   // Turnovers
      '27': 'A/T',  // Assist/Turnover Ratio
    }

    // Parse stats array/object
    for (const statKey in statsObj) {
      if (statKey === 'count') continue

      const statItem = statsObj[statKey]?.stat
      if (!statItem) continue

      let statInfo: Record<string, unknown> = {}
      if (Array.isArray(statItem)) {
        for (const prop of statItem) {
          if (typeof prop === 'object' && prop !== null) {
            Object.assign(statInfo, prop)
          }
        }
      } else if (typeof statItem === 'object') {
        statInfo = statItem as Record<string, unknown>
      }

      const statId = String(statInfo.stat_id || '')
      const statName = statIdMap[statId]
      const statValue = parseFloat(String(statInfo.value || '0'))

      if (statName) {
        stats[statName] = statValue
      }
    }

    console.log('Parsed player weekly stats:', stats)
    return stats
  } catch (error) {
    console.error('Error fetching player weekly stats:', error)
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data)
      if (error.response?.status === 401) {
        const authError = new Error('Authentication failed. Please reconnect your Yahoo account.')
        ;(authError as Error & { status: number }).status = 401
        throw authError
      }
    }
    throw error
  }
}

/**
 * Fetch team's weekly stats for a specific week
 * Returns the team's accumulated stats for that week
 */
export async function getTeamWeeklyStats(
  accessToken: string,
  teamKey: string,
  week: number
): Promise<Record<string, number>> {
  try {
    // Fetch team's matchup stats for the specified week
    const url = `${YAHOO_FANTASY_API_BASE}/team/${teamKey}/matchups;weeks=${week}?format=json`

    console.log('Fetching weekly stats from:', url)

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    console.log('Weekly stats response:', JSON.stringify(response.data, null, 2))

    const team = response.data?.fantasy_content?.team
    console.log('Team object type:', Array.isArray(team) ? 'array' : typeof team)
    console.log('Team length:', Array.isArray(team) ? team.length : 'not array')
    if (!team || !Array.isArray(team) || team.length < 2) {
      console.log('Invalid team structure - returning empty')
      return {}
    }

    const matchupsObj = team[1]?.matchups
    console.log('Matchups object:', matchupsObj ? Object.keys(matchupsObj) : 'null')
    if (!matchupsObj || typeof matchupsObj !== 'object') {
      console.log('No matchups found - returning empty')
      return {}
    }

    // Get the matchup for the specified week
    const matchupData = matchupsObj['0']?.matchup || matchupsObj[0]?.matchup
    console.log('Matchup data found:', !!matchupData)
    console.log('Matchup data length:', Array.isArray(matchupData) ? matchupData.length : 'not array')
    if (!matchupData) {
      console.log('No matchup data found - returning empty')
      return {}
    }

    // Find the team's stats within the matchup
    // matchup[0] contains matchup info
    // matchup[1] contains teams data: {"0": {"team": [...]}, "1": {"team": [...]}}
    const teamsData = matchupData[1]
    console.log('Teams data:', teamsData ? Object.keys(teamsData) : 'null')
    if (!teamsData || typeof teamsData !== 'object') {
      console.log('No teams data in matchup - returning empty')
      return {}
    }

    // Find our team in the matchup
    console.log(`Looking for team: ${teamKey}`)
    for (const key in teamsData) {
      if (key === 'count') continue

      const teamItem = teamsData[key]?.team
      console.log(`Team item ${key}:`, teamItem ? 'exists' : 'null', Array.isArray(teamItem) ? `array length ${teamItem.length}` : typeof teamItem)
      if (!teamItem || !Array.isArray(teamItem)) continue

      // team[0] contains team info
      let teamInfo: Record<string, unknown> = {}
      if (Array.isArray(teamItem[0])) {
        for (const prop of teamItem[0]) {
          if (typeof prop === 'object' && prop !== null) {
            Object.assign(teamInfo, prop)
          }
        }
      } else if (typeof teamItem[0] === 'object') {
        teamInfo = teamItem[0] as Record<string, unknown>
      }

      console.log(`Team info for ${key}:`, teamInfo.team_key, teamInfo.team_key === teamKey ? '(MATCH!)' : '(not match)')

      // Check if this is our team
      if (teamInfo.team_key !== teamKey) continue

      console.log(`Found target team! Extracting stats...`)

      // team[1] contains team_stats
      const teamStatsData = teamItem[1]?.team_stats
      console.log('team_stats exists:', !!teamStatsData)
      console.log('team_stats keys:', teamStatsData ? Object.keys(teamStatsData) : 'null')
      if (!teamStatsData || typeof teamStatsData !== 'object') {
        console.log('No team_stats found - skipping')
        continue
      }

      // Parse stats
      // team_stats[1]?.stats contains the actual stats array
      const statsData = teamStatsData[1] || teamStatsData['1'] || teamStatsData
      console.log('statsData keys:', statsData ? Object.keys(statsData) : 'null')
      const statsObj = statsData?.stats
      console.log('statsObj exists:', !!statsObj)
      console.log('statsObj keys:', statsObj ? Object.keys(statsObj) : 'null')

      if (!statsObj || typeof statsObj !== 'object') {
        console.log('No stats object found - skipping')
        continue
      }

      const stats: Record<string, number> = {}
      let statsCount = 0

      // Parse stats array/object
      for (const statKey in statsObj) {
        if (statKey === 'count') continue

        const statItem = statsObj[statKey]?.stat
        if (!statItem) continue

        let statInfo: Record<string, unknown> = {}
        if (Array.isArray(statItem)) {
          for (const prop of statItem) {
            if (typeof prop === 'object' && prop !== null) {
              Object.assign(statInfo, prop)
            }
          }
        } else if (typeof statItem === 'object') {
          statInfo = statItem as Record<string, unknown>
        }

        // Map stat_id to readable name
        const statIdMap: Record<string, string> = {
          '5': 'FGM',   // Field Goals Made
          '8': 'FGA',   // Field Goals Attempted
          '9': 'FG%',   // Field Goal Percentage
          '6': 'FTM',   // Free Throws Made
          '11': 'FTA',  // Free Throws Attempted
          '10': 'FT%',  // Free Throw Percentage
          '1': '3PTM',  // 3-pointers Made
          '12': 'PTS',  // Points
          '15': 'OREB', // Offensive Rebounds
          '16': 'REB',  // Total Rebounds
          '17': 'AST',  // Assists
          '18': 'ST',   // Steals
          '19': 'BLK',  // Blocks
          '20': 'TO',   // Turnovers
          '27': 'A/T',  // Assist/Turnover Ratio
        }

        const statId = String(statInfo.stat_id || '')
        const statName = statIdMap[statId]
        const statValue = parseFloat(String(statInfo.value || '0'))

        if (statName) {
          stats[statName] = statValue
          statsCount++
          console.log(`  Mapped stat ${statId} -> ${statName}: ${statValue}`)
        }
      }

      console.log(`Total stats extracted: ${statsCount}`)
      console.log(`Final stats object:`, stats)
      return stats
    }

    console.log('No matching team found - returning empty')
    return {}
  } catch (error) {
    console.error('Error fetching team weekly stats:', error)
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data)
      if (error.response?.status === 401) {
        const authError = new Error('Authentication failed. Please reconnect your Yahoo account.')
        ;(authError as Error & { status: number }).status = 401
        throw authError
      }
    }
    throw error
  }
}
