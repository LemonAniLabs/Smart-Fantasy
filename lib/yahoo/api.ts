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
        let teamInfo: any = {}

        if (Array.isArray(teamItem[0])) {
          // team[0] is an array of individual property objects - merge them
          for (const prop of teamItem[0]) {
            if (typeof prop === 'object' && prop !== null) {
              teamInfo = { ...teamInfo, ...prop }
            }
          }
        } else if (typeof teamItem[0] === 'object') {
          // team[0] is already a single object with all properties
          teamInfo = teamItem[0]
        }

        // Convert numeric is_owned_by_current_login (0/1) to boolean
        if ('is_owned_by_current_login' in teamInfo) {
          teamInfo.is_owned_by_current_login = teamInfo.is_owned_by_current_login === 1 || teamInfo.is_owned_by_current_login === true
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

    const roster = team[1]?.roster
    if (!roster || !Array.isArray(roster) || roster.length === 0) {
      console.log('No roster found')
      return []
    }

    const playersObj = roster[0]?.players
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
        let playerInfo: any = {}

        if (Array.isArray(playerItem[0])) {
          // player[0] is an array of individual property objects - merge them
          for (const prop of playerItem[0]) {
            if (typeof prop === 'object' && prop !== null) {
              playerInfo = { ...playerInfo, ...prop }
            }
          }
        } else if (typeof playerItem[0] === 'object') {
          // player[0] is already a single object with all properties
          playerInfo = playerItem[0]
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
    }
    throw error
  }
}

/**
 * Fetch league settings (categories, scoring type, etc.)
 */
export async function getLeagueSettings(accessToken: string, leagueKey: string) {
  try {
    const url = `${YAHOO_FANTASY_API_BASE}/league/${leagueKey}/settings`
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    return response.data.fantasy_content?.league?.[1]?.settings || {}
  } catch (error) {
    console.error('Error fetching league settings:', error)
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
    let url = `${YAHOO_FANTASY_API_BASE}/league/${leagueKey}/players;status=A` // A = Available
    
    if (position) {
      url += `;position=${position}`
    }
    if (start !== undefined) {
      url += `;start=${start}`
    }
    if (count !== undefined) {
      url += `;count=${count}`
    }

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    return response.data.fantasy_content?.league?.[1]?.players || []
  } catch (error) {
    console.error('Error fetching available players:', error)
    throw error
  }
}
