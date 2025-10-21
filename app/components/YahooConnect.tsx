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
  team_standings?: {
    rank?: number
    outcome_totals?: {
      wins?: number
      losses?: number
      ties?: number
    }
  }
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
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null)
  const [roster, setRoster] = useState<Player[]>([])
  const [opponentTeam, setOpponentTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [loadingMatchup, setLoadingMatchup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [debugData, setDebugData] = useState<string>('')
  const [view, setView] = useState<'myteam' | 'allteams' | 'matchup' | 'settings'>('myteam')
  const [leagueSettings, setLeagueSettings] = useState<unknown>(null)
  const [loadingSettings, setLoadingSettings] = useState(false)

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

      setAllTeams(teamsData.teams || [])

      // Find the user's team
      const userTeam = teamsData.teams?.find((team: Team) => team.is_owned_by_current_login)
      console.log('Found user team:', userTeam)
      if (!userTeam) {
        throw new Error('Could not find your team in this league')
      }

      setMyTeam(userTeam)
      setViewingTeam(userTeam)

      // Fetch my team's roster
      await fetchTeamRoster(userTeam.team_key)

      // Fetch current week's matchup
      fetchMatchup(userTeam.team_key)

      // Fetch league settings
      fetchLeagueSettings(league.league_key)
    } catch (err: unknown) {
      setError((err as Error).message)
      console.error('Error fetching team data:', err)
      setMyTeam(null)
      setRoster([])
    } finally {
      setLoadingTeam(false)
    }
  }

  const fetchTeamRoster = async (teamKey: string) => {
    try {
      const rosterResponse = await fetch(`/api/yahoo/roster?teamKey=${teamKey}`)
      if (!rosterResponse.ok) {
        const errorData = await rosterResponse.json()
        throw new Error(errorData.error || 'Failed to fetch roster')
      }
      const rosterData = await rosterResponse.json()
      console.log('Roster data:', rosterData)

      setRoster(rosterData.roster || [])

      if (!rosterData.roster || rosterData.roster.length === 0) {
        console.warn('No roster data received!')
      }
    } catch (err) {
      console.error('Error fetching roster:', err)
      setRoster([])
    }
  }

  const fetchMatchup = async (teamKey: string) => {
    setLoadingMatchup(true)
    try {
      const matchupResponse = await fetch(`/api/yahoo/matchup?teamKey=${teamKey}`)
      if (!matchupResponse.ok) {
        console.warn('Failed to fetch matchup')
        return
      }
      const matchupData = await matchupResponse.json()
      console.log('Matchup data:', matchupData)

      // Find opponent team from matchup data
      // matchup structure: {"0": {"teams": {...}}}
      if (matchupData.matchup) {
        const matchupObj = matchupData.matchup
        const teamsData = matchupObj['0']?.teams || matchupObj.teams
        if (teamsData) {
          // Find opponent (the team that is not mine)
          for (const key in teamsData) {
            if (key === 'count') continue
            const teamItem = teamsData[key]?.team
            if (teamItem && Array.isArray(teamItem) && teamItem[0]) {
              const teamInfo: Partial<Team> = {}
              if (Array.isArray(teamItem[0])) {
                for (const prop of teamItem[0]) {
                  if (typeof prop === 'object' && prop !== null) {
                    Object.assign(teamInfo, prop)
                  }
                }
              }
              // Check if this is NOT my team
              if (teamInfo.team_key && teamInfo.team_key !== teamKey) {
                setOpponentTeam(teamInfo as Team)
                break
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching matchup:', err)
    } finally {
      setLoadingMatchup(false)
    }
  }

  const fetchLeagueSettings = async (leagueKey: string) => {
    setLoadingSettings(true)
    try {
      const settingsResponse = await fetch(`/api/yahoo/settings?leagueKey=${leagueKey}`)
      if (!settingsResponse.ok) {
        console.warn('Failed to fetch league settings')
        return
      }
      const settingsData = await settingsResponse.json()
      console.log('League settings data:', settingsData)
      setLeagueSettings(settingsData.settings || null)
    } catch (err) {
      console.error('Error fetching league settings:', err)
    } finally {
      setLoadingSettings(false)
    }
  }

  const handleViewTeam = async (team: Team) => {
    setViewingTeam(team)
    setView('myteam')
    await fetchTeamRoster(team.team_key)
  }

  const fetchDebugData = async () => {
    if (!myTeam) return

    try {
      const response = await fetch(`/api/yahoo/roster/debug?teamKey=${myTeam.team_key}`)
      const data = await response.json()
      setDebugData(JSON.stringify(data, null, 2))
      setShowDebug(true)
    } catch (err) {
      console.error('Error fetching debug data:', err)
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
                  setAllTeams([])
                  setRoster([])
                  setOpponentTeam(null)
                }}
                className="text-purple-300 hover:text-purple-100 text-sm mb-3 flex items-center gap-1"
              >
                ← Back to Leagues
              </button>

              <h3 className="text-lg font-semibold text-white mb-4">
                {selectedLeague.name}
              </h3>

              {/* Sub Navigation */}
              {myTeam && (
                <div className="flex gap-2 mb-4 flex-wrap">
                  <button
                    onClick={() => setView('myteam')}
                    className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                      view === 'myteam'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-purple-200 hover:bg-slate-600'
                    }`}
                  >
                    我的球隊
                  </button>
                  <button
                    onClick={() => setView('matchup')}
                    className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                      view === 'matchup'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-purple-200 hover:bg-slate-600'
                    }`}
                  >
                    本周對手 {opponentTeam && '🔥'}
                  </button>
                  <button
                    onClick={() => setView('allteams')}
                    className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                      view === 'allteams'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-purple-200 hover:bg-slate-600'
                    }`}
                  >
                    所有隊伍
                  </button>
                  <button
                    onClick={() => setView('settings')}
                    className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                      view === 'settings'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-purple-200 hover:bg-slate-600'
                    }`}
                  >
                    League 設定 ⚙️
                  </button>
                </div>
              )}

              {loadingTeam && (
                <p className="text-purple-200">Loading...</p>
              )}

              {/* My Team / Viewing Team View */}
              {view === 'myteam' && viewingTeam && !loadingTeam && (
                <div className="space-y-4">
                  <div className="bg-slate-800/50 p-4 rounded">
                    <div className="font-semibold text-white text-lg">
                      {viewingTeam.name}
                      {viewingTeam.is_owned_by_current_login && (
                        <span className="ml-2 text-xs bg-green-600 px-2 py-1 rounded">你的球隊</span>
                      )}
                    </div>
                    <div className="text-xs text-purple-200 mt-1">Team Key: {viewingTeam.team_key}</div>
                  </div>

                  {roster.length > 0 ? (
                    <div className="bg-slate-800/50 p-4 rounded">
                      <h4 className="font-semibold text-white mb-3 text-lg">
                        Roster ({roster.length} players)
                      </h4>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {roster.map((player, index) => (
                          <div
                            key={player.player_key || index}
                            className="bg-slate-700/50 p-3 rounded hover:bg-slate-700/70 transition-colors"
                          >
                            <div className="font-medium text-white">{player.name?.full || 'Unknown Player'}</div>
                            <div className="text-xs text-purple-200 mt-1">
                              {player.eligible_positions?.join(', ') || 'No positions'}
                              {player.selected_position && typeof player.selected_position === 'object' && 'position' in player.selected_position
                                ? ` • Current: ${player.selected_position.position}`
                                : player.selected_position && typeof player.selected_position === 'string'
                                ? ` • Current: ${player.selected_position}`
                                : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-3 text-sm text-yellow-200">
                        No roster data available. This might be because the roster has not been set yet.
                      </div>

                      <button
                        onClick={fetchDebugData}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded"
                      >
                        Show Debug Info
                      </button>

                      {showDebug && debugData && (
                        <div className="bg-slate-900/90 rounded-lg p-4 overflow-x-auto">
                          <div className="flex justify-between items-center mb-2">
                            <h5 className="font-semibold text-white text-sm">Raw API Response:</h5>
                            <button
                              onClick={() => setShowDebug(false)}
                              className="text-purple-300 hover:text-white text-xs"
                            >
                              Hide
                            </button>
                          </div>
                          <pre className="text-xs text-green-300 whitespace-pre-wrap break-words">
                            {debugData}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* All Teams View */}
              {view === 'allteams' && allTeams.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-white text-lg mb-3">
                    所有隊伍 ({allTeams.length} teams)
                  </h4>
                  <div className="space-y-2">
                    {allTeams.map((team, index) => (
                      <div
                        key={team.team_key || index}
                        className="bg-slate-800/50 p-3 rounded hover:bg-slate-700/50 transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-white">
                              {team.name}
                              {team.is_owned_by_current_login && (
                                <span className="ml-2 text-xs bg-green-600 px-2 py-1 rounded">你的球隊</span>
                              )}
                            </div>
                            <div className="text-xs text-purple-200 mt-1">
                              Team ID: {team.team_id}
                            </div>
                          </div>
                          <button
                            onClick={() => handleViewTeam(team)}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1 rounded font-semibold"
                          >
                            查看 Roster
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matchup View */}
              {view === 'matchup' && (
                <div className="space-y-4">
                  {loadingMatchup && (
                    <p className="text-purple-200">Loading matchup...</p>
                  )}

                  {!loadingMatchup && opponentTeam && (
                    <div>
                      <h4 className="font-semibold text-white text-lg mb-3">
                        本周對戰 🔥
                      </h4>

                      <div className="flex flex-col md:flex-row items-center gap-4">
                        {/* My Team */}
                        <div className="flex-1 w-full bg-green-900/20 border-2 border-green-600 rounded-lg p-4">
                          <div className="text-center mb-2">
                            <div className="text-xs text-green-400 font-semibold">你的球隊</div>
                            <div className="text-lg font-bold text-white mt-1">{myTeam?.name}</div>
                          </div>
                          <button
                            onClick={() => {
                              if (myTeam) handleViewTeam(myTeam)
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded font-semibold mt-2"
                          >
                            查看我的 Roster
                          </button>
                        </div>

                        {/* VS */}
                        <div className="flex items-center justify-center px-4">
                          <div className="text-4xl font-bold text-purple-400">VS</div>
                        </div>

                        {/* Opponent Team */}
                        <div className="flex-1 w-full bg-red-900/20 border-2 border-red-600 rounded-lg p-4">
                          <div className="text-center mb-2">
                            <div className="text-xs text-red-400 font-semibold">對手球隊</div>
                            <div className="text-lg font-bold text-white mt-1">{opponentTeam.name}</div>
                          </div>
                          <button
                            onClick={() => handleViewTeam(opponentTeam)}
                            className="w-full bg-red-600 hover:bg-red-700 text-white text-sm py-2 rounded font-semibold mt-2"
                          >
                            查看對手 Roster
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 bg-slate-800/50 p-4 rounded">
                        <h5 className="font-semibold text-white text-sm mb-2">戰略提示</h5>
                        <p className="text-purple-200 text-sm">
                          點擊「查看對手 Roster」來分析對手的球員陣容，找出他們的優勢和弱點，制定你的戰略！
                        </p>
                      </div>
                    </div>
                  )}

                  {!loadingMatchup && !opponentTeam && (
                    <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-3 text-sm text-yellow-200">
                      無法獲取本周對手資訊。可能還沒有安排對戰或賽季尚未開始。
                    </div>
                  )}
                </div>
              )}

              {/* League Settings View */}
              {view === 'settings' && (
                <div className="space-y-4">
                  {loadingSettings && (
                    <p className="text-purple-200">Loading league settings...</p>
                  )}

                  {!loadingSettings && leagueSettings ? (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-white text-lg mb-3">
                        League 設定 ⚙️
                      </h4>

                      {(() => {
                        const settings = Array.isArray(leagueSettings) ? leagueSettings[0] : leagueSettings as Record<string, unknown>
                        const scoringType = settings.scoring_type === 'head' ? 'Head-to-Head' : settings.scoring_type as string
                        const isAuction = settings.is_auction_draft === '1'
                        const draftType = isAuction ? 'Auction Draft' : 'Snake Draft'

                        // Parse stat categories
                        const statCategoriesData = settings.stat_categories as { stats?: Array<{ stat: { enabled: string; display_name: string; is_only_display_stat?: string } }> } | undefined
                        const enabledStats = statCategoriesData?.stats?.filter((s: { stat: { enabled: string; is_only_display_stat?: string } }) =>
                          s.stat.enabled === '1' && s.stat.is_only_display_stat !== '1'
                        ).map((s: { stat: { display_name: string } }) => s.stat.display_name) || []

                        // Parse roster positions
                        const rosterPositions = settings.roster_positions as Array<{ roster_position: { position: string; count: number | string; is_starting_position: number | string } }> | undefined
                        const startingPositions = rosterPositions?.filter((r: { roster_position: { is_starting_position: number | string } }) =>
                          r.roster_position.is_starting_position === 1 || r.roster_position.is_starting_position === '1'
                        ) || []
                        const benchPositions = rosterPositions?.filter((r: { roster_position: { is_starting_position: number | string } }) =>
                          r.roster_position.is_starting_position === 0 || r.roster_position.is_starting_position === '0'
                        ) || []

                        return (
                          <>
                            {/* League Format */}
                            <div className="bg-slate-800/50 p-4 rounded">
                              <h5 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
                                🏀 League 格式
                              </h5>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="text-purple-300 text-xs">計分方式</div>
                                  <div className="text-white font-medium">{scoringType}</div>
                                </div>
                                <div>
                                  <div className="text-purple-300 text-xs">選秀類型</div>
                                  <div className="text-white font-medium">{draftType}</div>
                                </div>
                                <div>
                                  <div className="text-purple-300 text-xs">隊伍數量</div>
                                  <div className="text-white font-medium">{settings.max_teams} Teams</div>
                                </div>
                                <div>
                                  <div className="text-purple-300 text-xs">統計類別</div>
                                  <div className="text-white font-medium">{enabledStats.length}-Cat</div>
                                </div>
                              </div>
                            </div>

                            {/* Scoring Categories */}
                            <div className="bg-slate-800/50 p-4 rounded">
                              <h5 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
                                📊 統計類別 ({enabledStats.length} Categories)
                              </h5>
                              <div className="flex flex-wrap gap-2">
                                {enabledStats.map((stat: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="bg-purple-900/50 border border-purple-600 px-3 py-1 rounded text-white text-sm font-medium"
                                  >
                                    {stat}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Roster Configuration */}
                            <div className="bg-slate-800/50 p-4 rounded">
                              <h5 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
                                👥 Roster 配置
                              </h5>
                              <div className="space-y-3">
                                <div>
                                  <div className="text-purple-300 text-xs mb-2">先發位置</div>
                                  <div className="flex flex-wrap gap-2">
                                    {startingPositions.map((pos: { roster_position: { position: string; count: number | string } }, idx: number) => (
                                      <span
                                        key={idx}
                                        className="bg-green-900/30 border border-green-600 px-3 py-1 rounded text-green-300 text-sm"
                                      >
                                        {pos.roster_position.position} × {pos.roster_position.count}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-purple-300 text-xs mb-2">板凳 / 傷病名單</div>
                                  <div className="flex flex-wrap gap-2">
                                    {benchPositions.map((pos: { roster_position: { position: string; count: number | string } }, idx: number) => (
                                      <span
                                        key={idx}
                                        className="bg-slate-700 border border-slate-500 px-3 py-1 rounded text-slate-300 text-sm"
                                      >
                                        {pos.roster_position.position} × {pos.roster_position.count}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Waiver & Trading */}
                            <div className="bg-slate-800/50 p-4 rounded">
                              <h5 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
                                🔄 Waiver & 交易
                              </h5>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="text-purple-300 text-xs">Waiver 類型</div>
                                  <div className="text-white font-medium">
                                    {settings.waiver_type === 'R' ? 'Rolling Waivers' : settings.waiver_type as string}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-purple-300 text-xs">每週可加入人數</div>
                                  <div className="text-white font-medium">{settings.max_weekly_adds}</div>
                                </div>
                                <div>
                                  <div className="text-purple-300 text-xs">交易截止日</div>
                                  <div className="text-white font-medium">{settings.trade_end_date as string}</div>
                                </div>
                                <div>
                                  <div className="text-purple-300 text-xs">交易批准方式</div>
                                  <div className="text-white font-medium">
                                    {settings.trade_ratify_type === 'vote' ? 'League Vote' : settings.trade_ratify_type as string}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Playoff Settings */}
                            <div className="bg-slate-800/50 p-4 rounded">
                              <h5 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
                                🏆 Playoff 設定
                              </h5>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="text-purple-300 text-xs">Playoff 隊伍數</div>
                                  <div className="text-white font-medium">{settings.num_playoff_teams} Teams</div>
                                </div>
                                <div>
                                  <div className="text-purple-300 text-xs">開始週次</div>
                                  <div className="text-white font-medium">Week {settings.playoff_start_week as string}</div>
                                </div>
                                <div>
                                  <div className="text-purple-300 text-xs">安慰賽</div>
                                  <div className="text-white font-medium">
                                    {settings.has_playoff_consolation_games ? 'Yes' : 'No'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-purple-300 text-xs">Playoff 重新排序</div>
                                  <div className="text-white font-medium">
                                    {settings.uses_playoff_reseeding === 1 ? 'Yes' : 'No'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  ) : null}

                  {!loadingSettings && !leagueSettings && (
                    <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-3 text-sm text-yellow-200">
                      無法獲取 League 設定資訊。
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
