'use client'

import { useState, useEffect } from 'react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts'

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

interface TeamStats {
  teamName: string
  ppg: number
  rpg: number
  apg: number
  spg: number
  bpg: number
  threepm: number
  fgPct: number
  ftPct: number
  tov: number
}

interface TeamComparisonProps {
  allTeams: Team[]
  myTeamKey: string
  onClose: () => void
}

export default function TeamComparison({ allTeams, myTeamKey, onClose }: TeamComparisonProps) {
  const [selectedTeams, setSelectedTeams] = useState<string[]>([myTeamKey])
  const [teamStats, setTeamStats] = useState<Record<string, TeamStats>>({})
  const [loading, setLoading] = useState(false)
  const [playerStatsMap, setPlayerStatsMap] = useState<Record<string, PlayerStats>>({})

  useEffect(() => {
    fetchPlayerStats()
  }, [])

  useEffect(() => {
    if (Object.keys(playerStatsMap).length > 0) {
      calculateTeamStats()
    }
  }, [selectedTeams, playerStatsMap])

  const fetchPlayerStats = async () => {
    try {
      const response = await fetch('/api/nba/stats?season=2025')
      const data = await response.json()
      if (data.stats) {
        setPlayerStatsMap(data.stats)
      }
    } catch (error) {
      console.error('Error fetching player stats:', error)
    }
  }

  const calculateTeamStats = async () => {
    setLoading(true)
    const newTeamStats: Record<string, TeamStats> = {}

    for (const teamKey of selectedTeams) {
      try {
        const rosterResponse = await fetch(`/api/yahoo/roster?teamKey=${teamKey}`)
        const rosterData = await rosterResponse.json()
        const roster: Player[] = rosterData.roster || []

        let totalPPG = 0, totalRPG = 0, totalAPG = 0, totalSPG = 0, totalBPG = 0
        let totalThreePM = 0, totalFGPct = 0, totalFTPct = 0, totalTOV = 0
        let playerCount = 0

        roster.forEach((player) => {
          const stats = playerStatsMap[player.name.full]
          if (stats) {
            totalPPG += stats.ppg
            totalRPG += stats.rpg
            totalAPG += stats.apg
            totalSPG += stats.spg
            totalBPG += stats.bpg
            totalThreePM += stats.threepm
            totalFGPct += stats.fgPct
            totalFTPct += stats.ftPct
            totalTOV += stats.tpg
            playerCount++
          }
        })

        const team = allTeams.find(t => t.team_key === teamKey)
        if (team && playerCount > 0) {
          newTeamStats[teamKey] = {
            teamName: team.name,
            ppg: totalPPG,
            rpg: totalRPG,
            apg: totalAPG,
            spg: totalSPG,
            bpg: totalBPG,
            threepm: totalThreePM,
            fgPct: (totalFGPct / playerCount) * 100,
            ftPct: (totalFTPct / playerCount) * 100,
            tov: totalTOV,
          }
        }
      } catch (error) {
        console.error(`Error calculating stats for team ${teamKey}:`, error)
      }
    }

    setTeamStats(newTeamStats)
    setLoading(false)
  }

  const toggleTeamSelection = (teamKey: string) => {
    if (selectedTeams.includes(teamKey)) {
      if (selectedTeams.length > 1) {
        setSelectedTeams(selectedTeams.filter(k => k !== teamKey))
      }
    } else {
      if (selectedTeams.length < 3) {
        setSelectedTeams([...selectedTeams, teamKey])
      }
    }
  }

  // Prepare data for radar chart
  const getRadarData = () => {
    if (selectedTeams.length === 0) return []

    const categories = [
      { key: 'ppg', name: '得分', max: 150 },
      { key: 'rpg', name: '籃板', max: 60 },
      { key: 'apg', name: '助攻', max: 35 },
      { key: 'spg', name: '抄截', max: 12 },
      { key: 'bpg', name: '阻攻', max: 8 },
      { key: 'threepm', name: '三分', max: 15 },
      { key: 'fgPct', name: 'FG%', max: 100 },
      { key: 'ftPct', name: 'FT%', max: 100 },
    ]

    return categories.map(cat => {
      const dataPoint: { category: string; [key: string]: string | number } = { category: cat.name }
      selectedTeams.forEach(teamKey => {
        const stats = teamStats[teamKey]
        if (stats) {
          const value = stats[cat.key as keyof TeamStats] as number
          // Normalize to percentage of max
          dataPoint[stats.teamName] = (value / cat.max) * 100
        }
      })
      return dataPoint
    })
  }

  const getTeamColor = (index: number) => {
    const colors = ['#10b981', '#ef4444', '#3b82f6']
    return colors[index] || '#6b7280'
  }

  const analyzeStrengthsWeaknesses = () => {
    if (selectedTeams.length === 0 || !teamStats[selectedTeams[0]]) return null

    const myTeamStats = teamStats[myTeamKey]
    if (!myTeamStats) return null

    const categories = [
      { key: 'ppg', name: '得分' },
      { key: 'rpg', name: '籃板' },
      { key: 'apg', name: '助攻' },
      { key: 'spg', name: '抄截' },
      { key: 'bpg', name: '阻攻' },
      { key: 'threepm', name: '三分' },
    ]

    const strengths: string[] = []
    const weaknesses: string[] = []

    categories.forEach(cat => {
      const myValue = myTeamStats[cat.key as keyof TeamStats] as number
      const otherTeamsValues = selectedTeams
        .filter(k => k !== myTeamKey)
        .map(k => teamStats[k]?.[cat.key as keyof TeamStats] as number)
        .filter(v => v !== undefined)

      if (otherTeamsValues.length > 0) {
        const avgOthers = otherTeamsValues.reduce((a, b) => a + b, 0) / otherTeamsValues.length
        if (myValue > avgOthers * 1.1) {
          strengths.push(cat.name)
        } else if (myValue < avgOthers * 0.9) {
          weaknesses.push(cat.name)
        }
      }
    })

    return { strengths, weaknesses }
  }

  const analysis = analyzeStrengthsWeaknesses()

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto border border-purple-500/30 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-900 to-slate-900 p-4 flex justify-between items-center border-b border-purple-500/30 z-10">
          <h3 className="text-xl font-bold text-white">球隊數據比較</h3>
          <button
            onClick={onClose}
            className="text-purple-200 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Team Selection */}
          <div>
            <h4 className="text-white font-semibold mb-3">選擇球隊（最多 3 支）</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {allTeams.map((team, index) => {
                const isSelected = selectedTeams.includes(team.team_key)
                const isMyTeam = team.team_key === myTeamKey
                const selectionIndex = selectedTeams.indexOf(team.team_key)
                return (
                  <button
                    key={team.team_key}
                    onClick={() => toggleTeamSelection(team.team_key)}
                    disabled={!isSelected && selectedTeams.length >= 3}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? `${selectionIndex === 0 ? 'border-green-500 bg-green-900/30' : selectionIndex === 1 ? 'border-red-500 bg-red-900/30' : 'border-blue-500 bg-blue-900/30'}`
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    } ${!isSelected && selectedTeams.length >= 3 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="text-white text-sm font-medium">{team.name}</div>
                    {isMyTeam && (
                      <div className="text-xs text-green-400 mt-1">你的球隊</div>
                    )}
                    {isSelected && (
                      <div className="text-xs mt-1" style={{ color: getTeamColor(selectionIndex) }}>
                        已選擇 ({selectionIndex + 1})
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
              <p className="text-purple-200 mt-4">計算球隊數據中...</p>
            </div>
          )}

          {!loading && selectedTeams.length > 0 && Object.keys(teamStats).length > 0 && (
            <>
              {/* Radar Chart */}
              <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                <h4 className="text-white font-semibold mb-4 text-center">多維度數據比較</h4>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={getRadarData()}>
                    <PolarGrid stroke="#475569" />
                    <PolarAngleAxis dataKey="category" tick={{ fill: '#e2e8f0', fontSize: 12 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    {selectedTeams.map((teamKey, index) => {
                      const stats = teamStats[teamKey]
                      if (!stats) return null
                      return (
                        <Radar
                          key={teamKey}
                          name={stats.teamName}
                          dataKey={stats.teamName}
                          stroke={getTeamColor(index)}
                          fill={getTeamColor(index)}
                          fillOpacity={0.25}
                          strokeWidth={2}
                        />
                      )
                    })}
                    <Legend wrapperStyle={{ color: '#fff' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Stats Table */}
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 overflow-x-auto">
                <h4 className="text-white font-semibold mb-3">詳細數據對比</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-slate-400 pb-2 px-2">球隊</th>
                      <th className="text-center text-slate-400 pb-2 px-2">得分</th>
                      <th className="text-center text-slate-400 pb-2 px-2">籃板</th>
                      <th className="text-center text-slate-400 pb-2 px-2">助攻</th>
                      <th className="text-center text-slate-400 pb-2 px-2">抄截</th>
                      <th className="text-center text-slate-400 pb-2 px-2">阻攻</th>
                      <th className="text-center text-slate-400 pb-2 px-2">三分</th>
                      <th className="text-center text-slate-400 pb-2 px-2">FG%</th>
                      <th className="text-center text-slate-400 pb-2 px-2">FT%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTeams.map((teamKey, index) => {
                      const stats = teamStats[teamKey]
                      if (!stats) return null
                      return (
                        <tr key={teamKey} className="border-b border-slate-700/50">
                          <td className="py-2 px-2">
                            <span className="font-medium" style={{ color: getTeamColor(index) }}>
                              {stats.teamName}
                            </span>
                          </td>
                          <td className="text-center text-white py-2 px-2">{stats.ppg.toFixed(1)}</td>
                          <td className="text-center text-white py-2 px-2">{stats.rpg.toFixed(1)}</td>
                          <td className="text-center text-white py-2 px-2">{stats.apg.toFixed(1)}</td>
                          <td className="text-center text-white py-2 px-2">{stats.spg.toFixed(1)}</td>
                          <td className="text-center text-white py-2 px-2">{stats.bpg.toFixed(1)}</td>
                          <td className="text-center text-white py-2 px-2">{stats.threepm.toFixed(1)}</td>
                          <td className="text-center text-white py-2 px-2">{stats.fgPct.toFixed(1)}%</td>
                          <td className="text-center text-white py-2 px-2">{stats.ftPct.toFixed(1)}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Analysis */}
              {analysis && selectedTeams.includes(myTeamKey) && (
                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-4 rounded-lg border border-purple-500/30">
                  <h4 className="text-white font-semibold mb-3">🔍 分析結果</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-green-400 font-medium mb-2">✅ 優勢項目</div>
                      {analysis.strengths.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {analysis.strengths.map(str => (
                            <span key={str} className="px-3 py-1 bg-green-900/50 border border-green-600 rounded text-green-300 text-sm">
                              {str}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-sm">沒有明顯優勢</p>
                      )}
                    </div>
                    <div>
                      <div className="text-red-400 font-medium mb-2">⚠️ 劣勢項目</div>
                      {analysis.weaknesses.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {analysis.weaknesses.map(weak => (
                            <span key={weak} className="px-3 py-1 bg-red-900/50 border border-red-600 rounded text-red-300 text-sm">
                              {weak}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-sm">沒有明顯劣勢</p>
                      )}
                    </div>
                  </div>
                  {analysis.weaknesses.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-purple-500/30">
                      <div className="text-blue-400 font-medium mb-2">💡 建議</div>
                      <p className="text-slate-300 text-sm">
                        考慮從 Free Agents 中尋找能補強以下類別的球員：{analysis.weaknesses.join('、')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
