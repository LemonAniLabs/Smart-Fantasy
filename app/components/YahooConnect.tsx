'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'

interface League {
  league_key: string
  league_id: string
  name: string
  season: string
  num_teams: number
}

interface Team {
  team_key: string
  team_id: string
  name: string
  is_owned_by_current_login: boolean
}

interface Player {
  player_key: string
  player_id: string
  name: {
    full: string
  }
  position_type: string
  eligible_positions: string[]
  selected_position?: {
    position: string
  }
}

export default function YahooConnect() {
  const { data: session, status } = useSession()
  const [leagues, setLeagues] = useState<League[]>([])
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null)
  const [myTeam, setMyTeam] = useState<Team | null>(null)
  const [roster, setRoster] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session?.accessToken) {
      fetchLeagues()
    }
  }, [session])

  const fetchLeagues = async () => {
    setLoading(true)
    setError(null)
    try {
      // Try current season (2025 = 2024-25 NBA season)
      const response = await fetch('/api/yahoo/leagues?season=2025')
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch leagues')
      }
      const data = await response.json()
      console.log('Leagues data:', data)
      setLeagues(data.leagues || [])
    } catch (err: unknown) {
      setError((err as Error).message)
      console.error('Error fetching leagues:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectLeague = async (league: League) => {
    setSelectedLeague(league)
    setLoadingTeam(true)
    setError(null)

    try {
      // Fetch all teams in the league
      const teamsResponse = await fetch(`/api/yahoo/teams?leagueKey=${league.league_key}`)
      if (!teamsResponse.ok) {
        const errorData = await teamsResponse.json()
        throw new Error(errorData.error || 'Failed to fetch teams')
      }
      const teamsData = await teamsResponse.json()
      console.log('Teams data:', teamsData)
      console.log('Teams array:', teamsData.teams)
      console.log('First team structure:', teamsData.teams?.[0])

      // Find the user's team
      const userTeam = teamsData.teams?.find((team: Team) => team.is_owned_by_current_login)
      console.log('Found user team:', userTeam)
      if (!userTeam) {
        throw new Error('Could not find your team in this league')
      }

      setMyTeam(userTeam)

      // Fetch the team's roster
      const rosterResponse = await fetch(`/api/yahoo/roster?teamKey=${userTeam.team_key}`)
      if (!rosterResponse.ok) {
        const errorData = await rosterResponse.json()
        throw new Error(errorData.error || 'Failed to fetch roster')
      }
      const rosterData = await rosterResponse.json()
      console.log('Roster data:', rosterData)

      setRoster(rosterData.roster || [])
    } catch (err: unknown) {
      setError((err as Error).message)
      console.error('Error fetching team data:', err)
      setMyTeam(null)
      setRoster([])
    } finally {
      setLoadingTeam(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
        <p className="text-white">Loading session...</p>
      </div>
    )
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-4">Yahoo Fantasy Connection</h2>
      
      {!session ? (
        <div className="space-y-4">
          <p className="text-purple-200">
            Connect your Yahoo Fantasy account to import your leagues and players.
          </p>
          <button
            onClick={() => signIn('yahoo')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            </svg>
            Connect with Yahoo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-green-400 font-semibold">✓ Connected to Yahoo</p>
              <p className="text-sm text-purple-200">{session.user?.email}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded text-sm"
            >
              Disconnect
            </button>
          </div>

          {loading && (
            <p className="text-purple-200">Loading your leagues...</p>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-500 rounded-lg p-3 text-sm text-red-200">
              Error: {error}
            </div>
          )}

          {leagues.length > 0 && !selectedLeague && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Your Leagues</h3>
              <div className="space-y-2">
                {leagues.map((league, index) => (
                  <div
                    key={index}
                    className="bg-slate-800/50 p-3 rounded flex justify-between items-center"
                  >
                    <div>
                      <div className="font-semibold text-white">{league.name}</div>
                      <div className="text-xs text-purple-200">
                        {league.season} | {league.num_teams} teams
                      </div>
                    </div>
                    <button
                      onClick={() => handleSelectLeague(league)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs font-semibold"
                    >
                      View Team
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedLeague && (
            <div>
              <button
                onClick={() => {
                  setSelectedLeague(null)
                  setMyTeam(null)
                  setRoster([])
                }}
                className="text-purple-300 hover:text-purple-100 text-sm mb-3 flex items-center gap-1"
              >
                ← Back to Leagues
              </button>

              <h3 className="text-lg font-semibold text-white mb-2">
                {selectedLeague.name}
              </h3>

              {loadingTeam && (
                <p className="text-purple-200">Loading your team...</p>
              )}

              {myTeam && !loadingTeam && (
                <div className="space-y-4">
                  <div className="bg-slate-800/50 p-3 rounded">
                    <div className="font-semibold text-white">{myTeam.name}</div>
                    <div className="text-xs text-purple-200">Team ID: {myTeam.team_id}</div>
                  </div>

                  {roster.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-white mb-2">Roster ({roster.length} players)</h4>
                      <div className="space-y-1 max-h-96 overflow-y-auto">
                        {roster.map((player, index) => (
                          <div
                            key={index}
                            className="bg-slate-800/30 p-2 rounded flex justify-between items-center text-sm"
                          >
                            <div>
                              <div className="text-white">{player.name.full}</div>
                              <div className="text-xs text-purple-200">
                                {player.eligible_positions?.join(', ')}
                                {player.selected_position && ` • ${player.selected_position.position}`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && leagues.length === 0 && !error && (
            <p className="text-purple-200 text-sm">
              No leagues found for the current season. Try creating a league on Yahoo Fantasy Basketball!
            </p>
          )}
        </div>
      )}
    </div>
  )
}
