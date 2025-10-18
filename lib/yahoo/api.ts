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
    const seasonYear = season || new Date().getFullYear().toString()
    // nba is the game code for basketball
    const url = `${YAHOO_FANTASY_API_BASE}/users;use_login=1/games;game_codes=nba;seasons=${seasonYear}/leagues`
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    // Parse XML response (Yahoo returns XML by default)
    // You may need to add xml2js package to parse this properly
    return response.data.fantasy_content?.users?.[0]?.user?.[1]?.games?.[0]?.game?.[1]?.leagues || []
  } catch (error) {
    console.error('Error fetching Yahoo leagues:', error)
    throw error
  }
}

/**
 * Fetch teams in a specific league
 */
export async function getLeagueTeams(accessToken: string, leagueKey: string): Promise<YahooTeam[]> {
  try {
    const url = `${YAHOO_FANTASY_API_BASE}/league/${leagueKey}/teams`
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    return response.data.fantasy_content?.league?.[1]?.teams || []
  } catch (error) {
    console.error('Error fetching league teams:', error)
    throw error
  }
}

/**
 * Fetch roster for a specific team
 */
export async function getTeamRoster(accessToken: string, teamKey: string): Promise<YahooPlayer[]> {
  try {
    const url = `${YAHOO_FANTASY_API_BASE}/team/${teamKey}/roster`
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    return response.data.fantasy_content?.team?.[1]?.roster?.[0]?.players || []
  } catch (error) {
    console.error('Error fetching team roster:', error)
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
