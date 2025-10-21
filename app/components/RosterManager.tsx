'use client'

import { useState, useEffect } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer } from 'recharts'

interface RosterManagerProps {
  teamKey: string
  teamName: string
  leagueKey: string
  leagueSettings: unknown
  allTeams?: Array<{ team_key: string; team_id: string; name: string; is_owned_by_current_login: boolean }>
  onClose: () => void
}

interface Player {
  player_key: string
  player_id: string
  name: {
    full: string
  }
  position_type: string
  eligible_positions: string[]
  selected_position?: string | { position: string }
  status?: string
  injury_note?: string
}

interface PlayerStats {
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

interface PlayerWithStats extends Player {
  stats?: PlayerStats
}

interface RosterPosition {
  position: string
  count: number
  is_starting: boolean
}

export default function RosterManager({ teamKey, teamName, leagueKey, leagueSettings, allTeams, onClose }: RosterManagerProps) {
  const [roster, setRoster] = useState<Player[]>([])
  const [playerStatsMap, setPlayerStatsMap] = useState<Record<string, PlayerStats>>({})
  const [loading, setLoading] = useState(true)
  const [rosterPositions, setRosterPositions] = useState<RosterPosition[]>([])
  const [comparePlayer1, setComparePlayer1] = useState<PlayerWithStats | null>(null)
  const [comparePlayer2, setComparePlayer2] = useState<PlayerWithStats | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const [showPlayerSelector, setShowPlayerSelector] = useState(false)
  const [playerSelectorSource, setPlayerSelectorSource] = useState<'my-team' | 'free-agents' | 'other-teams'>('my-team')
  const [freeAgents, setFreeAgents] = useState<PlayerWithStats[]>([])
  const [otherTeamRosters, setOtherTeamRosters] = useState<Record<string, Player[]>>({})
  const [loadingFreeAgents, setLoadingFreeAgents] = useState(false)
  const [selectedOtherTeam, setSelectedOtherTeam] = useState<string>('')

  useEffect(() => {
    fetchData()
    parseRosterPositions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamKey])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch roster
      const rosterResponse = await fetch(`/api/yahoo/roster?teamKey=${teamKey}`)
      if (rosterResponse.ok) {
        const rosterData = await rosterResponse.json()
        setRoster(rosterData.roster || [])
      }

      // Fetch NBA stats
      const statsResponse = await fetch('/api/nba/stats?season=2025')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setPlayerStatsMap(statsData.stats || {})
      }
    } catch (error) {
      console.error('Error fetching roster data:', error)
    } finally {
      setLoading(false)
    }
  }

  const parseRosterPositions = () => {
    if (!leagueSettings) return

    const settings = Array.isArray(leagueSettings) ? leagueSettings[0] : leagueSettings as Record<string, unknown>
    const rosterPositionsData = settings.roster_positions as Array<{
      roster_position: {
        position: string
        count: number | string
        is_starting_position: number | string
      }
    }> | undefined

    if (!rosterPositionsData) return

    const positions: RosterPosition[] = rosterPositionsData.map((item) => ({
      position: item.roster_position.position,
      count: typeof item.roster_position.count === 'string' ? parseInt(item.roster_position.count) : item.roster_position.count,
      is_starting: item.roster_position.is_starting_position === 1 || item.roster_position.is_starting_position === '1',
    }))

    setRosterPositions(positions)
  }

  const getSelectedPosition = (player: Player): string => {
    if (!player.selected_position) return 'BN'
    if (typeof player.selected_position === 'string') return player.selected_position
    if (typeof player.selected_position === 'object' && 'position' in player.selected_position) {
      return player.selected_position.position
    }
    return 'BN'
  }

  const getPlayersInSlot = (position: string): PlayerWithStats[] => {
    return roster
      .filter((player) => getSelectedPosition(player) === position)
      .map((player) => ({
        ...player,
        stats: playerStatsMap[player.name.full],
      }))
  }

  const isInjured = (player: Player): boolean => {
    const status = player.status?.toUpperCase()
    return status ? ['INJ', 'GTD', 'O', 'DTD', 'OUT'].includes(status) : false
  }

  const getInjuryStatusBadge = (player: Player) => {
    if (!player.status) return null

    const status = player.status.toUpperCase()
    let bgColor = 'bg-red-600'
    const textColor = 'text-white'

    if (status === 'GTD') {
      bgColor = 'bg-yellow-600'
    } else if (status === 'DTD') {
      bgColor = 'bg-orange-600'
    }

    return (
      <span className={`px-2 py-0.5 ${bgColor} ${textColor} rounded text-xs font-bold ml-2`}>
        {status}
      </span>
    )
  }

  const fetchFreeAgents = async () => {
    setLoadingFreeAgents(true)
    try {
      const response = await fetch(`/api/yahoo/freeagents?leagueKey=${leagueKey}&count=50`)
      if (response.ok) {
        const data = await response.json()
        const agents: Player[] = data.freeAgents || []
        const agentsWithStats: PlayerWithStats[] = agents.map((agent) => ({
          ...agent,
          stats: playerStatsMap[agent.name.full],
        }))
        setFreeAgents(agentsWithStats)
      }
    } catch (error) {
      console.error('Error fetching free agents:', error)
    } finally {
      setLoadingFreeAgents(false)
    }
  }

  const fetchOtherTeamRoster = async (otherTeamKey: string) => {
    if (otherTeamRosters[otherTeamKey]) return // Already loaded

    try {
      const response = await fetch(`/api/yahoo/roster?teamKey=${otherTeamKey}`)
      if (response.ok) {
        const data = await response.json()
        setOtherTeamRosters((prev) => ({
          ...prev,
          [otherTeamKey]: data.roster || [],
        }))
      }
    } catch (error) {
      console.error('Error fetching other team roster:', error)
    }
  }

  const handleSelectForComparison = (player: PlayerWithStats) => {
    if (!comparePlayer1) {
      setComparePlayer1(player)
      setShowPlayerSelector(true) // Show player selector for second player
    } else if (!comparePlayer2) {
      setComparePlayer2(player)
      setShowComparison(true)
      setShowPlayerSelector(false)
    } else {
      // Reset and start new comparison
      setComparePlayer1(player)
      setComparePlayer2(null)
      setShowComparison(false)
      setShowPlayerSelector(true)
    }
  }

  const handleSelectPlayer2 = (player: PlayerWithStats) => {
    setComparePlayer2(player)
    setShowComparison(true)
    setShowPlayerSelector(false)
  }

  const resetComparison = () => {
    setComparePlayer1(null)
    setComparePlayer2(null)
    setShowComparison(false)
  }

  const getPlayerRadarData = (stats1: PlayerStats, stats2?: PlayerStats) => {
    const categories = [
      { key: 'ppg', name: '得分', max: 35 },
      { key: 'rpg', name: '籃板', max: 15 },
      { key: 'apg', name: '助攻', max: 12 },
      { key: 'spg', name: '抄截', max: 3 },
      { key: 'bpg', name: '阻攻', max: 3 },
      { key: 'threepm', name: '三分', max: 5 },
      { key: 'fgPct', name: 'FG%', max: 0.60 },
      { key: 'ftPct', name: 'FT%', max: 0.95 },
    ]

    return categories.map((cat) => {
      const value1 = stats1[cat.key as keyof PlayerStats] as number
      const normalizedValue1 = Math.min((value1 / cat.max) * 100, 100)

      if (stats2) {
        const value2 = stats2[cat.key as keyof PlayerStats] as number
        const normalizedValue2 = Math.min((value2 / cat.max) * 100, 100)
        return {
          category: cat.name,
          [stats1.name]: normalizedValue1,
          [stats2.name]: normalizedValue2,
        }
      }

      return {
        category: cat.name,
        數值: normalizedValue1,
      }
    })
  }

  const startingPositions = rosterPositions.filter((p) => p.is_starting)
  const benchPositions = rosterPositions.filter((p) => !p.is_starting)

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-lg p-8 max-w-6xl w-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            <p className="text-purple-200 mt-4">載入 Roster...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden border border-purple-500/30 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-900 to-slate-900 p-4 border-b border-purple-500/30">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white">Roster Manager</h3>
              <p className="text-sm text-purple-200 mt-1">{teamName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-purple-200 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Comparison Bar */}
        {(comparePlayer1 || comparePlayer2) && (
          <div className="bg-purple-900/30 border-b border-purple-500/30 p-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="text-purple-300 text-sm font-semibold">比較球員:</span>
                {comparePlayer1 && (
                  <span className="px-2 sm:px-3 py-1 bg-blue-600 text-white rounded text-xs sm:text-sm">
                    {comparePlayer1.name.full}
                  </span>
                )}
                {comparePlayer1 && !comparePlayer2 && (
                  <span className="text-purple-300 text-xs sm:text-sm">← 選擇第二位球員</span>
                )}
                {comparePlayer2 && (
                  <>
                    <span className="text-purple-300 text-xs sm:text-sm">vs</span>
                    <span className="px-2 sm:px-3 py-1 bg-green-600 text-white rounded text-xs sm:text-sm">
                      {comparePlayer2.name.full}
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={resetComparison}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs sm:text-sm self-start sm:self-auto"
              >
                重置
              </button>
            </div>
          </div>
        )}

        {/* Player Selector Modal */}
        {showPlayerSelector && comparePlayer1 && !comparePlayer2 && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-10">
            <div className="bg-slate-800 rounded-lg w-full max-w-4xl max-h-[85vh] sm:max-h-[90vh] overflow-hidden border border-purple-500/30">
              <div className="bg-gradient-to-r from-purple-900 to-slate-900 p-3 sm:p-4 border-b border-purple-500/30">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg sm:text-xl font-bold text-white">選擇第二位球員進行比較</h4>
                  <button
                    onClick={() => setShowPlayerSelector(false)}
                    className="text-purple-200 hover:text-white"
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Source Selector */}
              <div className="flex gap-2 p-3 bg-slate-900/50 border-b border-slate-700 flex-wrap">
                <button
                  onClick={() => setPlayerSelectorSource('my-team')}
                  className={`px-3 py-1.5 rounded text-xs sm:text-sm font-semibold transition-colors ${
                    playerSelectorSource === 'my-team'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  我的球隊
                </button>
                <button
                  onClick={() => {
                    setPlayerSelectorSource('free-agents')
                    if (freeAgents.length === 0) fetchFreeAgents()
                  }}
                  className={`px-3 py-1.5 rounded text-xs sm:text-sm font-semibold transition-colors ${
                    playerSelectorSource === 'free-agents'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Free Agents
                </button>
                {allTeams && allTeams.length > 1 && (
                  <button
                    onClick={() => setPlayerSelectorSource('other-teams')}
                    className={`px-3 py-1.5 rounded text-xs sm:text-sm font-semibold transition-colors ${
                      playerSelectorSource === 'other-teams'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    其他球隊
                  </button>
                )}
              </div>

              {/* Player List */}
              <div className="overflow-y-auto p-3 sm:p-4" style={{ maxHeight: 'calc(85vh - 180px)' }}>
                {playerSelectorSource === 'my-team' && (
                  <div className="space-y-2">
                    {roster.map((player) => {
                      const stats = playerStatsMap[player.name.full]
                      if (player.player_key === comparePlayer1.player_key) return null // Don't show player 1

                      return (
                        <div
                          key={player.player_key}
                          onClick={() => handleSelectPlayer2({ ...player, stats })}
                          className="bg-slate-700/50 border-2 border-slate-600 hover:border-purple-500 rounded p-2 sm:p-3 cursor-pointer transition-all"
                        >
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                <span className="font-medium text-white text-sm sm:text-base truncate">{player.name.full}</span>
                                {getInjuryStatusBadge(player)}
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                {player.eligible_positions?.join(', ')}
                              </div>
                            </div>
                            {stats && (
                              <div className="flex gap-2 text-xs">
                                <div className="text-center">
                                  <div className="text-blue-300 font-semibold">{stats.ppg.toFixed(1)}</div>
                                  <div className="text-slate-400">PPG</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-green-300 font-semibold">{stats.rpg.toFixed(1)}</div>
                                  <div className="text-slate-400">RPG</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-purple-300 font-semibold">{stats.apg.toFixed(1)}</div>
                                  <div className="text-slate-400">APG</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {playerSelectorSource === 'free-agents' && (
                  <div className="space-y-2">
                    {loadingFreeAgents && (
                      <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                        <p className="text-purple-200 mt-2 text-sm">載入 Free Agents...</p>
                      </div>
                    )}
                    {!loadingFreeAgents && freeAgents.map((player) => (
                      <div
                        key={player.player_key}
                        onClick={() => handleSelectPlayer2(player)}
                        className="bg-slate-700/50 border-2 border-slate-600 hover:border-purple-500 rounded p-2 sm:p-3 cursor-pointer transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                              <span className="font-medium text-white text-sm sm:text-base truncate">{player.name.full}</span>
                              {getInjuryStatusBadge(player)}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {player.eligible_positions?.join(', ')}
                            </div>
                          </div>
                          {player.stats && (
                            <div className="flex gap-2 text-xs">
                              <div className="text-center">
                                <div className="text-blue-300 font-semibold">{player.stats.ppg.toFixed(1)}</div>
                                <div className="text-slate-400">PPG</div>
                              </div>
                              <div className="text-center">
                                <div className="text-green-300 font-semibold">{player.stats.rpg.toFixed(1)}</div>
                                <div className="text-slate-400">RPG</div>
                              </div>
                              <div className="text-center">
                                <div className="text-purple-300 font-semibold">{player.stats.apg.toFixed(1)}</div>
                                <div className="text-slate-400">APG</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {playerSelectorSource === 'other-teams' && allTeams && (
                  <div className="space-y-3">
                    {!selectedOtherTeam && (
                      <div className="space-y-2">
                        <p className="text-purple-300 text-sm mb-2">選擇一個球隊：</p>
                        {allTeams.filter(t => t.team_key !== teamKey).map((team) => (
                          <div
                            key={team.team_key}
                            onClick={() => {
                              setSelectedOtherTeam(team.team_key)
                              fetchOtherTeamRoster(team.team_key)
                            }}
                            className="bg-slate-700/50 border-2 border-slate-600 hover:border-purple-500 rounded p-3 cursor-pointer transition-all"
                          >
                            <div className="font-medium text-white text-sm sm:text-base">{team.name}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedOtherTeam && (
                      <>
                        <button
                          onClick={() => setSelectedOtherTeam('')}
                          className="text-purple-300 hover:text-purple-100 text-xs sm:text-sm mb-3 flex items-center gap-1"
                        >
                          ← 返回選擇球隊
                        </button>
                        <div className="space-y-2">
                          {otherTeamRosters[selectedOtherTeam]?.map((player) => {
                            const stats = playerStatsMap[player.name.full]
                            return (
                              <div
                                key={player.player_key}
                                onClick={() => handleSelectPlayer2({ ...player, stats })}
                                className="bg-slate-700/50 border-2 border-slate-600 hover:border-purple-500 rounded p-2 sm:p-3 cursor-pointer transition-all"
                              >
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                      <span className="font-medium text-white text-sm sm:text-base truncate">{player.name.full}</span>
                                      {getInjuryStatusBadge(player)}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">
                                      {player.eligible_positions?.join(', ')}
                                    </div>
                                  </div>
                                  {stats && (
                                    <div className="flex gap-2 text-xs">
                                      <div className="text-center">
                                        <div className="text-blue-300 font-semibold">{stats.ppg.toFixed(1)}</div>
                                        <div className="text-slate-400">PPG</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-green-300 font-semibold">{stats.rpg.toFixed(1)}</div>
                                        <div className="text-slate-400">RPG</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-purple-300 font-semibold">{stats.apg.toFixed(1)}</div>
                                        <div className="text-slate-400">APG</div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {/* Starting Positions */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
              <span>🏀</span>
              先發陣容
            </h4>
            <div className="space-y-3">
              {startingPositions.map((posConfig) => {
                const players = getPlayersInSlot(posConfig.position)
                const slots = Array.from({ length: posConfig.count }, (_, i) => i)

                return (
                  <div key={posConfig.position} className="bg-green-900/10 border border-green-600/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-green-300 font-semibold text-sm">
                        {posConfig.position}
                      </span>
                      <span className="text-green-400 text-xs">
                        {players.length} / {posConfig.count}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {slots.map((slotIndex) => {
                        const player = players[slotIndex]
                        if (!player) {
                          return (
                            <div
                              key={slotIndex}
                              className="bg-slate-800/30 border border-dashed border-slate-600 rounded p-2 text-center text-slate-500 text-sm"
                            >
                              空位
                            </div>
                          )
                        }

                        const injured = isInjured(player)
                        const isSelected = comparePlayer1?.player_key === player.player_key || comparePlayer2?.player_key === player.player_key

                        return (
                          <div
                            key={player.player_key}
                            className={`bg-slate-800/50 border-2 rounded p-3 transition-all ${
                              injured ? 'border-red-600' : isSelected ? 'border-purple-500' : 'border-slate-700'
                            } hover:border-purple-400 cursor-pointer`}
                            onClick={() => handleSelectForComparison(player)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center">
                                  <span className="font-medium text-white">{player.name.full}</span>
                                  {getInjuryStatusBadge(player)}
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                  {player.eligible_positions?.join(', ')}
                                </div>
                              </div>
                              {player.stats && (
                                <div className="flex gap-2 text-xs">
                                  <div className="text-center">
                                    <div className="text-blue-300 font-semibold">{player.stats.ppg.toFixed(1)}</div>
                                    <div className="text-slate-400">PPG</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-green-300 font-semibold">{player.stats.rpg.toFixed(1)}</div>
                                    <div className="text-slate-400">RPG</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-purple-300 font-semibold">{player.stats.apg.toFixed(1)}</div>
                                    <div className="text-slate-400">APG</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bench Positions */}
          <div>
            <h4 className="text-lg font-semibold text-slate-400 mb-3 flex items-center gap-2">
              <span>📋</span>
              板凳 / 傷病名單
            </h4>
            <div className="space-y-3">
              {benchPositions.map((posConfig) => {
                const players = getPlayersInSlot(posConfig.position)
                const slots = Array.from({ length: posConfig.count }, (_, i) => i)

                return (
                  <div key={posConfig.position} className="bg-slate-800/30 border border-slate-600/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-300 font-semibold text-sm">
                        {posConfig.position}
                      </span>
                      <span className="text-slate-400 text-xs">
                        {players.length} / {posConfig.count}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {slots.map((slotIndex) => {
                        const player = players[slotIndex]
                        if (!player) {
                          return (
                            <div
                              key={slotIndex}
                              className="bg-slate-800/30 border border-dashed border-slate-600 rounded p-2 text-center text-slate-500 text-sm"
                            >
                              空位
                            </div>
                          )
                        }

                        const injured = isInjured(player)
                        const isSelected = comparePlayer1?.player_key === player.player_key || comparePlayer2?.player_key === player.player_key

                        return (
                          <div
                            key={player.player_key}
                            className={`bg-slate-800/50 border-2 rounded p-3 transition-all ${
                              injured ? 'border-red-600' : isSelected ? 'border-purple-500' : 'border-slate-700'
                            } hover:border-purple-400 cursor-pointer`}
                            onClick={() => handleSelectForComparison(player)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center">
                                  <span className="font-medium text-white">{player.name.full}</span>
                                  {getInjuryStatusBadge(player)}
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                  {player.eligible_positions?.join(', ')}
                                </div>
                              </div>
                              {player.stats && (
                                <div className="flex gap-2 text-xs">
                                  <div className="text-center">
                                    <div className="text-blue-300 font-semibold">{player.stats.ppg.toFixed(1)}</div>
                                    <div className="text-slate-400">PPG</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-green-300 font-semibold">{player.stats.rpg.toFixed(1)}</div>
                                    <div className="text-slate-400">RPG</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-purple-300 font-semibold">{player.stats.apg.toFixed(1)}</div>
                                    <div className="text-slate-400">APG</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Comparison Modal */}
        {showComparison && comparePlayer1 && comparePlayer2 && comparePlayer1.stats && comparePlayer2.stats && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-lg max-w-4xl w-full p-6 border border-purple-500/30 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-2xl font-bold text-white">球員比較</h4>
                <button
                  onClick={() => setShowComparison(false)}
                  className="text-purple-200 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Player 1 */}
                <div className="bg-blue-900/20 border-2 border-blue-600 rounded-lg p-4">
                  <h5 className="text-lg font-bold text-white mb-2">{comparePlayer1.name.full}</h5>
                  <div className="text-sm text-blue-300 mb-3">{comparePlayer1.stats.team} • {comparePlayer1.eligible_positions?.join(', ')}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">得分</span>
                      <span className="text-white font-semibold">{comparePlayer1.stats.ppg.toFixed(1)} PPG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">籃板</span>
                      <span className="text-white font-semibold">{comparePlayer1.stats.rpg.toFixed(1)} RPG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">助攻</span>
                      <span className="text-white font-semibold">{comparePlayer1.stats.apg.toFixed(1)} APG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">抄截</span>
                      <span className="text-white font-semibold">{comparePlayer1.stats.spg.toFixed(1)} SPG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">阻攻</span>
                      <span className="text-white font-semibold">{comparePlayer1.stats.bpg.toFixed(1)} BPG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">三分球</span>
                      <span className="text-white font-semibold">{comparePlayer1.stats.threepm.toFixed(1)} 3PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">FG%</span>
                      <span className="text-white font-semibold">{(comparePlayer1.stats.fgPct * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">FT%</span>
                      <span className="text-white font-semibold">{(comparePlayer1.stats.ftPct * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* Player 2 */}
                <div className="bg-green-900/20 border-2 border-green-600 rounded-lg p-4">
                  <h5 className="text-lg font-bold text-white mb-2">{comparePlayer2.name.full}</h5>
                  <div className="text-sm text-green-300 mb-3">{comparePlayer2.stats.team} • {comparePlayer2.eligible_positions?.join(', ')}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">得分</span>
                      <span className="text-white font-semibold">{comparePlayer2.stats.ppg.toFixed(1)} PPG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">籃板</span>
                      <span className="text-white font-semibold">{comparePlayer2.stats.rpg.toFixed(1)} RPG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">助攻</span>
                      <span className="text-white font-semibold">{comparePlayer2.stats.apg.toFixed(1)} APG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">抄截</span>
                      <span className="text-white font-semibold">{comparePlayer2.stats.spg.toFixed(1)} SPG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">阻攻</span>
                      <span className="text-white font-semibold">{comparePlayer2.stats.bpg.toFixed(1)} BPG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">三分球</span>
                      <span className="text-white font-semibold">{comparePlayer2.stats.threepm.toFixed(1)} 3PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">FG%</span>
                      <span className="text-white font-semibold">{(comparePlayer2.stats.fgPct * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">FT%</span>
                      <span className="text-white font-semibold">{(comparePlayer2.stats.ftPct * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Radar Chart Comparison */}
              <div className="bg-slate-900/50 p-4 rounded border border-purple-500/30">
                <h5 className="text-lg font-semibold text-purple-300 mb-4">數據雷達圖比較</h5>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={getPlayerRadarData(comparePlayer1.stats, comparePlayer2.stats)}>
                    <PolarGrid stroke="#475569" />
                    <PolarAngleAxis dataKey="category" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#475569" />
                    <Radar
                      name={comparePlayer1.name.full}
                      dataKey={comparePlayer1.name.full}
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.5}
                    />
                    <Radar
                      name={comparePlayer2.name.full}
                      dataKey={comparePlayer2.name.full}
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.5}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="mt-2 text-xs text-slate-400 text-center">
                  雷達圖比較兩位球員在各項統計類別的相對能力
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
