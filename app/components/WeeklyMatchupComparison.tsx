'use client'

import { useEffect, useState } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer } from 'recharts'

interface WeeklyMatchupComparisonProps {
  leagueKey: string
  allTeams: Array<{ team_key: string; team_id: string; name: string; is_owned_by_current_login: boolean }>
  myTeamKey: string
  currentWeek?: number
  leagueSettings?: unknown
  onClose: () => void
}

interface TeamWeeklyStats {
  team_key: string
  team_name: string
  stats: Record<string, number>
}

interface StatCategory {
  key: string
  name: string
  higherIsBetter: boolean
}

export default function WeeklyMatchupComparison({
  leagueKey,
  allTeams,
  myTeamKey,
  currentWeek = 1,
  leagueSettings,
  onClose,
}: WeeklyMatchupComparisonProps) {
  const [selectedTeams, setSelectedTeams] = useState<string[]>([myTeamKey])
  const [weeklyStats, setWeeklyStats] = useState<Record<string, TeamWeeklyStats>>({})
  const [loading, setLoading] = useState(true)
  const [statCategories, setStatCategories] = useState<StatCategory[]>([])
  const [selectedWeek, setSelectedWeek] = useState(currentWeek)

  // Team colors for radar chart
  const teamColors = [
    '#10b981', // green
    '#ef4444', // red
    '#3b82f6', // blue
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
    '#6366f1', // indigo
    '#06b6d4', // cyan
  ]

  useEffect(() => {
    // Parse league stat categories
    console.log('Parsing league settings:', leagueSettings)
    if (leagueSettings) {
      const settings = Array.isArray(leagueSettings) ? leagueSettings[0] : leagueSettings as Record<string, unknown>
      const statCategoriesData = settings.stat_categories as { stats?: Array<{ stat: { enabled: string; display_name: string; stat_id: number; is_only_display_stat?: string } }> } | undefined
      const enabledStats = statCategoriesData?.stats?.filter((s: { stat: { enabled: string; is_only_display_stat?: string } }) =>
        s.stat.enabled === '1' && s.stat.is_only_display_stat !== '1'
      ) || []

      console.log('Enabled stats:', enabledStats)

      // Map stat names to simplified keys
      const statMapping: Record<string, { key: string; higherIsBetter: boolean }> = {
        'Field Goals Made': { key: 'FGM', higherIsBetter: true },
        'Field Goals Attempted': { key: 'FGA', higherIsBetter: true },
        'Field Goal Percentage': { key: 'FG%', higherIsBetter: true },
        'Free Throws Made': { key: 'FTM', higherIsBetter: true },
        'Free Throws Attempted': { key: 'FTA', higherIsBetter: true },
        'Free Throw Percentage': { key: 'FT%', higherIsBetter: true },
        '3-pointers Made': { key: '3PTM', higherIsBetter: true },
        'Points': { key: 'PTS', higherIsBetter: true },
        'Offensive Rebounds': { key: 'OREB', higherIsBetter: true },
        'Rebounds': { key: 'REB', higherIsBetter: true },
        'Assists': { key: 'AST', higherIsBetter: true },
        'Steals': { key: 'ST', higherIsBetter: true },
        'Blocks': { key: 'BLK', higherIsBetter: true },
        'Turnovers': { key: 'TO', higherIsBetter: false },
        'Assist/Turnover Ratio': { key: 'A/T', higherIsBetter: true },
      }

      const categories = enabledStats
        .map((s: { stat: { display_name: string } }) => {
          const displayName = s.stat.display_name
          const mapped = statMapping[displayName]
          if (mapped) {
            return {
              key: mapped.key,
              name: displayName,
              higherIsBetter: mapped.higherIsBetter,
            }
          }
          return null
        })
        .filter((c): c is StatCategory => c !== null)

      console.log('Parsed stat categories:', categories)
      setStatCategories(categories)
    }
  }, [leagueSettings])

  useEffect(() => {
    if (selectedTeams.length > 0 && statCategories.length > 0) {
      fetchWeeklyStats()
    }
  }, [selectedTeams, selectedWeek, statCategories])

  const fetchWeeklyStats = async () => {
    setLoading(true)
    try {
      const statsPromises = selectedTeams.map(async (teamKey) => {
        console.log(`Fetching stats for team: ${teamKey}, week: ${selectedWeek}`)
        const response = await fetch(`/api/yahoo/weekly-stats?teamKey=${teamKey}&week=${selectedWeek}`)
        console.log(`Response status for ${teamKey}:`, response.status)

        if (response.ok) {
          const data = await response.json()
          console.log(`Stats data for ${teamKey}:`, data)
          return { teamKey, data: data.stats }
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error(`Failed to fetch stats for ${teamKey}:`, response.status, errorData)
          return null
        }
      })

      const results = await Promise.all(statsPromises)
      const statsMap: Record<string, TeamWeeklyStats> = {}

      results.forEach((result) => {
        if (result) {
          const team = allTeams.find((t) => t.team_key === result.teamKey)
          if (team) {
            statsMap[result.teamKey] = {
              team_key: result.teamKey,
              team_name: team.name,
              stats: result.data || {},
            }
          }
        }
      })

      console.log('Final stats map:', statsMap)
      setWeeklyStats(statsMap)
    } catch (error) {
      console.error('Error fetching weekly stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleTeamSelection = (teamKey: string) => {
    setSelectedTeams((prev) => {
      if (prev.includes(teamKey)) {
        // Don't allow deselecting all teams
        if (prev.length === 1) return prev
        return prev.filter((k) => k !== teamKey)
      } else {
        // Limit to 6 teams for readability
        if (prev.length >= 6) return prev
        return [...prev, teamKey]
      }
    })
  }

  const getRadarData = () => {
    if (statCategories.length === 0) return []

    return statCategories.map((cat) => {
      const dataPoint: Record<string, unknown> = { category: cat.key }

      selectedTeams.forEach((teamKey) => {
        const teamStats = weeklyStats[teamKey]
        if (teamStats) {
          const value = teamStats.stats[cat.key] || 0
          dataPoint[teamStats.team_name] = value
        }
      })

      return dataPoint
    })
  }

  const radarData = getRadarData()

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg w-full max-w-7xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 sm:p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">週數據對戰比較</h2>
            <p className="text-sm text-slate-400 mt-1">選擇最多 6 支球隊進行比較</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Week Selector */}
          <div className="bg-slate-900/50 rounded-lg p-4">
            <label className="block text-sm font-semibold text-white mb-2">選擇週次</label>
            <input
              type="number"
              min="1"
              max="24"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
              className="bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Team Selector */}
          <div className="bg-slate-900/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3">選擇球隊 ({selectedTeams.length}/6)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {allTeams.map((team, idx) => {
                const isSelected = selectedTeams.includes(team.team_key)
                const colorIndex = selectedTeams.indexOf(team.team_key)
                const teamColor = colorIndex >= 0 ? teamColors[colorIndex % teamColors.length] : undefined

                return (
                  <button
                    key={team.team_key}
                    onClick={() => toggleTeamSelection(team.team_key)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-purple-500 bg-purple-900/30'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isSelected && teamColor && (
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: teamColor }}
                        />
                      )}
                      <div className="flex-1">
                        <div className="font-semibold text-white text-sm">{team.name}</div>
                        {team.is_owned_by_current_login && (
                          <span className="text-xs text-green-400">你的球隊</span>
                        )}
                      </div>
                      {isSelected && <span className="text-purple-400">✓</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
              <p className="text-purple-200 mt-4">載入週數據中...</p>
            </div>
          ) : (
            <>
              {/* Radar Chart */}
              <div className="bg-slate-900/50 rounded-lg p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-white mb-4">雷達圖比較</h3>
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={500}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#475569" />
                      <PolarAngleAxis
                        dataKey="category"
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                      />
                      <PolarRadiusAxis angle={90} domain={[0, 'auto']} stroke="#475569" />
                      {selectedTeams.map((teamKey, idx) => {
                        const teamStats = weeklyStats[teamKey]
                        if (!teamStats) return null

                        const color = teamColors[idx % teamColors.length]
                        return (
                          <Radar
                            key={teamKey}
                            name={teamStats.team_name}
                            dataKey={teamStats.team_name}
                            stroke={color}
                            fill={color}
                            fillOpacity={0.25}
                            strokeWidth={2}
                          />
                        )
                      })}
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-12">請選擇球隊進行比較</p>
                )}
              </div>

              {/* Detailed Stats Table */}
              <div className="bg-slate-900/50 rounded-lg p-4 sm:p-6 overflow-x-auto">
                <h3 className="text-lg font-semibold text-white mb-4">詳細數據</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-slate-400 font-semibold py-2 px-2">球隊</th>
                      {statCategories.map((cat) => (
                        <th key={cat.key} className="text-center text-slate-400 font-semibold py-2 px-2">
                          {cat.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTeams.map((teamKey, idx) => {
                      const teamStats = weeklyStats[teamKey]
                      if (!teamStats) return null

                      const color = teamColors[idx % teamColors.length]

                      return (
                        <tr key={teamKey} className="border-b border-slate-700/50">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-white font-medium">{teamStats.team_name}</span>
                            </div>
                          </td>
                          {statCategories.map((cat) => {
                            const value = teamStats.stats[cat.key] || 0
                            const isPercentage = cat.key.includes('%')
                            const displayValue = isPercentage
                              ? (value * 100).toFixed(1) + '%'
                              : value.toFixed(cat.key === 'A/T' ? 2 : 0)

                            return (
                              <td key={cat.key} className="text-center py-3 px-2 text-white">
                                {displayValue}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
