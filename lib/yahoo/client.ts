/**
 * Yahoo Fantasy API Client (2-legged OAuth)
 * Uses developer credentials only - no user authentication required
 * For accessing public fantasy data
 */

import axios from 'axios'

const YAHOO_OAUTH_URL = 'https://api.login.yahoo.com/oauth2/get_token'
const YAHOO_FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'

interface YahooTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

class YahooFantasyClient {
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0
  private clientId: string
  private clientSecret: string

  constructor() {
    this.clientId = process.env.YAHOO_CLIENT_ID || ''
    this.clientSecret = process.env.YAHOO_CLIENT_SECRET || ''

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Yahoo client credentials not configured')
    }
  }

  /**
   * Get access token using client credentials (2-legged OAuth)
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')

      const response = await axios.post<YahooTokenResponse>(
        YAHOO_OAUTH_URL,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      )

      this.accessToken = response.data.access_token
      // Set expiration 5 minutes before actual expiry
      this.tokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000

      return this.accessToken
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string }
      console.error('Error getting Yahoo access token:', err.response?.data || err.message)
      throw new Error('Failed to authenticate with Yahoo API')
    }
  }

  /**
   * Make authenticated request to Yahoo Fantasy API
   */
  private async request(endpoint: string): Promise<unknown> {
    const token = await this.getAccessToken()

    try {
      const url = `${YAHOO_FANTASY_API_BASE}${endpoint}`

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      })

      return response.data
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string }
      console.error('Yahoo API request error:', err.response?.data || err.message)
      throw error
    }
  }

  /**
   * Get all available games (leagues across different seasons)
   */
  async getGames(gameCode: string = 'nba'): Promise<unknown> {
    return this.request(`/games;game_codes=${gameCode}`)
  }

  /**
   * Get game info for specific season
   */
  async getGameBySeason(season: string): Promise<unknown> {
    return this.request(`/game/nba;seasons=${season}`)
  }

  /**
   * Get public league info by league key
   */
  async getLeague(leagueKey: string): Promise<unknown> {
    return this.request(`/league/${leagueKey}`)
  }

  /**
   * Get league settings (categories, roster positions, etc.)
   */
  async getLeagueSettings(leagueKey: string): Promise<unknown> {
    return this.request(`/league/${leagueKey}/settings`)
  }

  /**
   * Get players for a specific game/season
   */
  async getPlayers(gameKey: string, options: {
    start?: number
    count?: number
    position?: string
    status?: string
  } = {}): Promise<unknown> {
    let endpoint = `/game/${gameKey}/players`

    const params: string[] = []
    if (options.start !== undefined) params.push(`start=${options.start}`)
    if (options.count !== undefined) params.push(`count=${options.count}`)
    if (options.position) params.push(`position=${options.position}`)
    if (options.status) params.push(`status=${options.status}`)

    if (params.length > 0) {
      endpoint += `;${params.join(';')}`
    }

    return this.request(endpoint)
  }

  /**
   * Get player stats for specific player
   */
  async getPlayerStats(playerKey: string): Promise<unknown> {
    return this.request(`/player/${playerKey}/stats`)
  }

  /**
   * Get NBA game key for current season
   */
  async getCurrentSeasonGameKey(): Promise<string> {
    const currentYear = new Date().getFullYear()
    const season = `${currentYear}`

    const gameData = await this.getGameBySeason(season) as { fantasy_content?: { game?: Array<{ game_key?: string }> } }

    return gameData.fantasy_content?.game?.[0]?.game_key || `nba.l.${currentYear}`
  }
}

// Export singleton instance
export const yahooClient = new YahooFantasyClient()
