'use client'

import { useEffect, useState } from 'react'

interface FreeAgentsProps {
  leagueKey: string
  myTeamKey: string
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

export default function FreeAgents({ leagueKey, myTeamKey, onClose }: FreeAgentsProps) {
  const [loading, setLoading] = useState(true)
  const [freeAgents, setFreeAgents] = useState<PlayerWithStats[]>([])
  const [filteredPlayers, setFilteredPlayers] = useState<PlayerWithStats[]>([])
  const [playerStatsMap, setPlayerStatsMap] = useState<Record<string, PlayerStats>>({})
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'ppg' | 'rpg' | 'apg'>('ppg')
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithStats | null>(null)

  const positions = ['ALL', 'PG', 'SG', 'G', 'SF', 'PF', 'F', 'C', 'UTIL']

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueKey])

  useEffect(() => {
    applyFilters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeAgents, selectedPosition, searchQuery, sortBy, playerStatsMap])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch NBA stats
      const statsResponse = await fetch('/api/nba/stats?season=2025')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setPlayerStatsMap(statsData.stats || {})
      }

      // Fetch free agents from Yahoo
      const response = await fetch(
        `/api/yahoo/freeagents?leagueKey=${leagueKey}&count=100`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch free agents')
      }

      const data = await response.json()
      const agents: Player[] = data.freeAgents || []

      // Merge with stats
      const agentsWithStats: PlayerWithStats[] = agents.map((agent) => ({
        ...agent,
        stats: undefined, // Will be set in applyFilters
      }))

      setFreeAgents(agentsWithStats)
    } catch (error) {
      console.error('Error fetching free agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...freeAgents]

    // Merge stats
    filtered = filtered.map((player) => ({
      ...player,
      stats: playerStatsMap[player.name.full],
    }))

    // Filter by position
    if (selectedPosition !== 'ALL') {
      filtered = filtered.filter((player) =>
        player.eligible_positions?.includes(selectedPosition)
      )
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((player) =>
        player.name.full.toLowerCase().includes(query)
      )
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.full.localeCompare(b.name.full)
      }

      const aValue = a.stats?.[sortBy] || 0
      const bValue = b.stats?.[sortBy] || 0
      return bValue - aValue // Descending
    })

    setFilteredPlayers(filtered)
  }

  const getPlayerValue = (stats: PlayerStats | undefined): number => {
    if (!stats) return 0
    // Simple fantasy value calculation
    return (
      stats.ppg * 1.0 +
      stats.rpg * 1.2 +
      stats.apg * 1.5 +
      stats.spg * 3.0 +
      stats.bpg * 3.0 +
      stats.threepm * 1.0 -
      stats.tpg * 1.0
    )
  }

  const getValueColor = (value: number): string => {
    if (value >= 40) return 'text-green-400'
    if (value >= 30) return 'text-blue-400'
    if (value >= 20) return 'text-purple-400'
    return 'text-slate-400'
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-lg p-8 max-w-6xl w-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            <p className="text-purple-200 mt-4">載入 Free Agents...</p>
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
              <h3 className="text-xl font-bold text-white">Free Agents</h3>
              <p className="text-sm text-purple-200 mt-1">
                {filteredPlayers.length} 位可用球員
              </p>
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

        {/* Filters */}
        <div className="bg-slate-800/50 p-4 border-b border-slate-700 space-y-3">
          {/* Search */}
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="搜尋球員姓名..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'ppg' | 'rpg' | 'apg')}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            >
              <option value="ppg">排序：得分</option>
              <option value="rpg">排序：籃板</option>
              <option value="apg">排序：助攻</option>
              <option value="name">排序：姓名</option>
            </select>
          </div>

          {/* Position Filter */}
          <div className="flex flex-wrap gap-2">
            {positions.map((pos) => (
              <button
                key={pos}
                onClick={() => setSelectedPosition(pos)}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                  selectedPosition === pos
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Player List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredPlayers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400">沒有找到符合條件的球員</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPlayers.map((player) => {
                const value = getPlayerValue(player.stats)
                return (
                  <div
                    key={player.player_key}
                    className="bg-slate-800/50 p-4 rounded-lg hover:bg-slate-700/50 transition-colors border border-slate-700 hover:border-purple-500/50"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setSelectedPlayer(player)}
                            className="text-lg font-semibold text-white hover:text-purple-300 transition-colors"
                          >
                            {player.name.full}
                          </button>
                          <div className="flex gap-1">
                            {player.eligible_positions?.map((pos, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-blue-900/50 border border-blue-600 rounded text-blue-300 text-xs"
                              >
                                {pos}
                              </span>
                            ))}
                          </div>
                        </div>

                        {player.stats ? (
                          <div className="mt-2 flex gap-4 text-sm">
                            <div className="text-center">
                              <div className="text-blue-300 font-semibold">
                                {player.stats.ppg.toFixed(1)}
                              </div>
                              <div className="text-slate-400 text-xs">PPG</div>
                            </div>
                            <div className="text-center">
                              <div className="text-green-300 font-semibold">
                                {player.stats.rpg.toFixed(1)}
                              </div>
                              <div className="text-slate-400 text-xs">RPG</div>
                            </div>
                            <div className="text-center">
                              <div className="text-purple-300 font-semibold">
                                {player.stats.apg.toFixed(1)}
                              </div>
                              <div className="text-slate-400 text-xs">APG</div>
                            </div>
                            <div className="text-center">
                              <div className="text-yellow-300 font-semibold">
                                {player.stats.spg.toFixed(1)}
                              </div>
                              <div className="text-slate-400 text-xs">STL</div>
                            </div>
                            <div className="text-center">
                              <div className="text-red-300 font-semibold">
                                {player.stats.bpg.toFixed(1)}
                              </div>
                              <div className="text-slate-400 text-xs">BLK</div>
                            </div>
                            <div className="text-center">
                              <div className="text-cyan-300 font-semibold">
                                {player.stats.threepm.toFixed(1)}
                              </div>
                              <div className="text-slate-400 text-xs">3PM</div>
                            </div>
                            <div className="text-center">
                              <div className="text-slate-300 font-semibold">
                                {(player.stats.fgPct * 100).toFixed(1)}%
                              </div>
                              <div className="text-slate-400 text-xs">FG%</div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-slate-500">
                            無統計數據（可能未達最低出賽場次）
                          </div>
                        )}
                      </div>

                      <div className="text-right ml-4">
                        <div className={`text-2xl font-bold ${getValueColor(value)}`}>
                          {value.toFixed(1)}
                        </div>
                        <div className="text-xs text-slate-400">Fantasy Value</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Player Detail Modal */}
        {selectedPlayer && selectedPlayer.stats && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-lg max-w-2xl w-full p-6 border border-purple-500/30">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-2xl font-bold text-white">
                    {selectedPlayer.name.full}
                  </h4>
                  <div className="flex gap-2 mt-2">
                    {selectedPlayer.eligible_positions?.map((pos, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-900/50 border border-blue-600 rounded text-blue-300 text-sm"
                      >
                        {pos}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="text-purple-200 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 p-3 rounded">
                  <div className="text-slate-400 text-sm">球隊</div>
                  <div className="text-white font-semibold">
                    {selectedPlayer.stats.team}
                  </div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded">
                  <div className="text-slate-400 text-sm">出賽場次</div>
                  <div className="text-white font-semibold">
                    {selectedPlayer.stats.gamesPlayed} GP
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="bg-blue-900/20 border border-blue-600 p-3 rounded text-center">
                  <div className="text-blue-300 text-sm">得分</div>
                  <div className="text-2xl font-bold text-white">
                    {selectedPlayer.stats.ppg.toFixed(1)}
                  </div>
                </div>
                <div className="bg-green-900/20 border border-green-600 p-3 rounded text-center">
                  <div className="text-green-300 text-sm">籃板</div>
                  <div className="text-2xl font-bold text-white">
                    {selectedPlayer.stats.rpg.toFixed(1)}
                  </div>
                </div>
                <div className="bg-purple-900/20 border border-purple-600 p-3 rounded text-center">
                  <div className="text-purple-300 text-sm">助攻</div>
                  <div className="text-2xl font-bold text-white">
                    {selectedPlayer.stats.apg.toFixed(1)}
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-slate-900/50 p-4 rounded">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">抄截</span>
                    <span className="text-yellow-300 font-medium">
                      {selectedPlayer.stats.spg.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">阻攻</span>
                    <span className="text-red-300 font-medium">
                      {selectedPlayer.stats.bpg.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">三分球</span>
                    <span className="text-cyan-300 font-medium">
                      {selectedPlayer.stats.threepm.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">失誤</span>
                    <span className="text-orange-300 font-medium">
                      {selectedPlayer.stats.tpg.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">投籃命中率</span>
                    <span className="text-white font-medium">
                      {(selectedPlayer.stats.fgPct * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">罰球命中率</span>
                    <span className="text-white font-medium">
                      {(selectedPlayer.stats.ftPct * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-purple-900/20 border border-purple-600 p-3 rounded">
                <div className="text-purple-300 text-sm mb-2">Fantasy Value</div>
                <div className="text-3xl font-bold text-white">
                  {getPlayerValue(selectedPlayer.stats).toFixed(1)}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  綜合評分（考慮所有統計類別）
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
