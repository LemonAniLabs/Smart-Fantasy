'use client'

import { useEffect, useState } from 'react'

interface AcquisitionRecommendationsProps {
  leagueKey: string
  myTeamKey: string
  myTeamName: string
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

interface TeamWeakness {
  category: string
  currentValue: number
  rank: 'weak' | 'moderate' | 'strong'
  priority: number
}

interface PlayerRecommendation {
  player: Player
  stats: PlayerStats
  impactScore: number
  strengthens: string[]
  fantasyValue: number
  reason: string
}

export default function AcquisitionRecommendations({
  leagueKey,
  myTeamKey,
  myTeamName,
  onClose,
}: AcquisitionRecommendationsProps) {
  const [loading, setLoading] = useState(true)
  const [weaknesses, setWeaknesses] = useState<TeamWeakness[]>([])
  const [recommendations, setRecommendations] = useState<PlayerRecommendation[]>([])
  const [playerStatsMap, setPlayerStatsMap] = useState<Record<string, PlayerStats>>({})
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')

  useEffect(() => {
    fetchRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTeamKey, leagueKey])

  const fetchRecommendations = async () => {
    setLoading(true)
    try {
      // Fetch NBA stats
      const statsResponse = await fetch('/api/nba/stats?season=2025')
      if (!statsResponse.ok) throw new Error('Failed to fetch NBA stats')
      const statsData = await statsResponse.json()
      const stats = statsData.stats || {}
      setPlayerStatsMap(stats)

      // Fetch my roster
      const rosterResponse = await fetch(`/api/yahoo/roster?teamKey=${myTeamKey}`)
      if (!rosterResponse.ok) throw new Error('Failed to fetch roster')
      const rosterData = await rosterResponse.json()
      const myRoster: Player[] = rosterData.roster || []

      // Calculate team stats and weaknesses
      const teamWeaknesses = analyzeTeamWeaknesses(myRoster, stats)
      setWeaknesses(teamWeaknesses)

      // Fetch free agents
      const freeAgentsResponse = await fetch(
        `/api/yahoo/freeagents?leagueKey=${leagueKey}&count=100`
      )
      if (!freeAgentsResponse.ok) throw new Error('Failed to fetch free agents')
      const faData = await freeAgentsResponse.json()
      const freeAgents: Player[] = faData.freeAgents || []

      // Generate recommendations
      const recs = generateRecommendations(
        freeAgents,
        stats,
        teamWeaknesses
      )
      setRecommendations(recs)
    } catch (error) {
      console.error('Error fetching recommendations:', error)
    } finally {
      setLoading(false)
    }
  }

  const analyzeTeamWeaknesses = (
    roster: Player[],
    statsMap: Record<string, PlayerStats>
  ): TeamWeakness[] => {
    let totalPPG = 0, totalRPG = 0, totalAPG = 0, totalSPG = 0, totalBPG = 0
    let total3PM = 0, totalFGPct = 0, totalFTPct = 0
    let playerCount = 0

    roster.forEach((player) => {
      const stats = statsMap[player.name.full]
      if (stats && stats.gamesPlayed >= 5) {
        totalPPG += stats.ppg
        totalRPG += stats.rpg
        totalAPG += stats.apg
        totalSPG += stats.spg
        totalBPG += stats.bpg
        total3PM += stats.threepm
        totalFGPct += stats.fgPct
        totalFTPct += stats.ftPct
        playerCount++
      }
    })

    // Define league average benchmarks (approximate)
    const benchmarks = {
      ppg: 110,
      rpg: 45,
      apg: 24,
      spg: 8,
      bpg: 5,
      threepm: 10,
      fgPct: 46, // percentage
      ftPct: 77, // percentage
    }

    const avgFGPct = playerCount > 0 ? (totalFGPct / playerCount) * 100 : 0
    const avgFTPct = playerCount > 0 ? (totalFTPct / playerCount) * 100 : 0

    const categories = [
      { category: '得分 (PTS)', value: totalPPG, benchmark: benchmarks.ppg },
      { category: '籃板 (REB)', value: totalRPG, benchmark: benchmarks.rpg },
      { category: '助攻 (AST)', value: totalAPG, benchmark: benchmarks.apg },
      { category: '抄截 (STL)', value: totalSPG, benchmark: benchmarks.spg },
      { category: '阻攻 (BLK)', value: totalBPG, benchmark: benchmarks.bpg },
      { category: '三分球 (3PM)', value: total3PM, benchmark: benchmarks.threepm },
      { category: '投籃命中率 (FG%)', value: avgFGPct, benchmark: benchmarks.fgPct },
      { category: '罰球命中率 (FT%)', value: avgFTPct, benchmark: benchmarks.ftPct },
    ]

    return categories
      .map((cat) => {
        const percentOfBenchmark = (cat.value / cat.benchmark) * 100
        let rank: 'weak' | 'moderate' | 'strong'
        let priority: number

        if (percentOfBenchmark < 85) {
          rank = 'weak'
          priority = 3
        } else if (percentOfBenchmark < 100) {
          rank = 'moderate'
          priority = 2
        } else {
          rank = 'strong'
          priority = 1
        }

        return {
          category: cat.category,
          currentValue: cat.value,
          rank,
          priority,
        }
      })
      .sort((a, b) => b.priority - a.priority)
  }

  const generateRecommendations = (
    freeAgents: Player[],
    statsMap: Record<string, PlayerStats>,
    weaknesses: TeamWeakness[]
  ): PlayerRecommendation[] => {
    const recs: PlayerRecommendation[] = []

    // Get weak and moderate weaknesses (not just weak)
    const targetWeaknesses = weaknesses.filter((w) => w.rank === 'weak' || w.rank === 'moderate')

    freeAgents.forEach((player) => {
      const stats = statsMap[player.name.full]
      if (!stats || stats.gamesPlayed < 5) return // Lower minimum games requirement

      const strengthens: string[] = []
      let impactScore = 0

      // Check which weaknesses this player addresses (lower thresholds)
      targetWeaknesses.forEach((weakness) => {
        if (weakness.category.includes('得分') && stats.ppg > 10) { // Lower from 15 to 10
          strengthens.push('得分')
          impactScore += stats.ppg * 2
        }
        if (weakness.category.includes('籃板') && stats.rpg > 5) { // Lower from 7 to 5
          strengthens.push('籃板')
          impactScore += stats.rpg * 3
        }
        if (weakness.category.includes('助攻') && stats.apg > 3) { // Lower from 5 to 3
          strengthens.push('助攻')
          impactScore += stats.apg * 4
        }
        if (weakness.category.includes('抄截') && stats.spg > 0.8) { // Lower from 1.2 to 0.8
          strengthens.push('抄截')
          impactScore += stats.spg * 8
        }
        if (weakness.category.includes('阻攻') && stats.bpg > 0.6) { // Lower from 1.0 to 0.6
          strengthens.push('阻攻')
          impactScore += stats.bpg * 8
        }
        if (weakness.category.includes('三分球') && stats.threepm > 1.5) { // Lower from 2 to 1.5
          strengthens.push('三分')
          impactScore += stats.threepm * 3
        }
        if (weakness.category.includes('投籃') && stats.fgPct > 0.45) { // Lower from 0.48 to 0.45
          strengthens.push('FG%')
          impactScore += stats.fgPct * 50
        }
        if (weakness.category.includes('罰球') && stats.ftPct > 0.75) { // Lower from 0.80 to 0.75
          strengthens.push('FT%')
          impactScore += stats.ftPct * 40
        }
      })

      // Only recommend players that strengthen at least 1 weakness
      if (strengthens.length > 0) {
        const fantasyValue =
          stats.ppg * 1.0 +
          stats.rpg * 1.2 +
          stats.apg * 1.5 +
          stats.spg * 3.0 +
          stats.bpg * 3.0 +
          stats.threepm * 1.0 -
          stats.tpg * 1.0

        let reason = ''
        if (strengthens.length === 1) {
          reason = `專精於 ${strengthens[0]}，可直接補強弱點`
        } else if (strengthens.length === 2) {
          reason = `同時補強 ${strengthens.join(' 和 ')}，雙重價值`
        } else {
          reason = `多方位球員，可補強 ${strengthens.join('、')}，全面提升`
        }

        recs.push({
          player,
          stats,
          impactScore,
          strengthens,
          fantasyValue,
          reason,
        })
      }
    })

    // Sort by impact score (descending)
    return recs.sort((a, b) => b.impactScore - a.impactScore).slice(0, 30) // Increase from 20 to 30
  }

  const getWeaknessColor = (rank: string) => {
    switch (rank) {
      case 'weak':
        return 'bg-red-900/30 border-red-600 text-red-300'
      case 'moderate':
        return 'bg-yellow-900/30 border-yellow-600 text-yellow-300'
      case 'strong':
        return 'bg-green-900/30 border-green-600 text-green-300'
      default:
        return 'bg-slate-800/50 border-slate-600'
    }
  }

  const getImpactColor = (score: number): string => {
    if (score >= 40) return 'text-green-400'
    if (score >= 30) return 'text-blue-400'
    if (score >= 20) return 'text-purple-400'
    return 'text-slate-400'
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-lg p-8 max-w-6xl w-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            <p className="text-purple-200 mt-4">分析球隊並生成補強建議...</p>
          </div>
        </div>
      </div>
    )
  }

  const filteredRecs =
    selectedCategory === 'ALL'
      ? recommendations
      : recommendations.filter((rec) =>
          rec.strengthens.includes(selectedCategory)
        )

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden border border-purple-500/30 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-orange-900 to-slate-900 p-4 border-b border-orange-500/30">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white">智能補強建議</h3>
              <p className="text-sm text-orange-200 mt-1">
                為 {myTeamName} 量身打造的 Free Agent 推薦
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-orange-200 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Team Weaknesses Analysis */}
          <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
            <h4 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              📉 球隊弱點分析
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {weaknesses.map((weakness, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${getWeaknessColor(weakness.rank)}`}
                >
                  <div className="text-sm font-medium mb-1">{weakness.category}</div>
                  <div className="text-2xl font-bold text-white">
                    {weakness.category.includes('%')
                      ? `${weakness.currentValue.toFixed(1)}%`
                      : weakness.currentValue.toFixed(1)}
                  </div>
                  <div className="text-xs mt-1">
                    {weakness.rank === 'weak' && '❌ 急需補強'}
                    {weakness.rank === 'moderate' && '⚠️ 可以更好'}
                    {weakness.rank === 'strong' && '✅ 表現良好'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h5 className="text-white font-semibold mb-3 text-sm">篩選補強類別：</h5>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                  selectedCategory === 'ALL'
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                全部推薦
              </button>
              {['得分', '籃板', '助攻', '抄截', '阻攻', '三分', 'FG%', 'FT%'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                    selectedCategory === cat
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Recommendations List */}
          <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
            <h4 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              🎯 推薦球員 ({filteredRecs.length})
            </h4>

            {filteredRecs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400">沒有符合此類別的推薦球員</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecs.map((rec, idx) => (
                  <div
                    key={rec.player.player_key}
                    className="bg-slate-700/50 p-4 rounded-lg border border-orange-500/30 hover:border-orange-500/60 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="bg-orange-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="text-lg font-bold text-white">
                              {rec.player.name.full}
                            </div>
                            <div className="flex gap-2 mt-1">
                              {rec.player.eligible_positions?.map((pos, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 bg-blue-900/50 border border-blue-600 rounded text-blue-300 text-xs"
                                >
                                  {pos}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-right ml-4">
                        <div className={`text-2xl font-bold ${getImpactColor(rec.impactScore)}`}>
                          {rec.impactScore.toFixed(0)}
                        </div>
                        <div className="text-xs text-slate-400">Impact Score</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-8 gap-3 mb-3 text-sm">
                      <div className="text-center">
                        <div className="text-blue-300 font-semibold">{rec.stats.ppg.toFixed(1)}</div>
                        <div className="text-slate-400 text-xs">PPG</div>
                      </div>
                      <div className="text-center">
                        <div className="text-green-300 font-semibold">{rec.stats.rpg.toFixed(1)}</div>
                        <div className="text-slate-400 text-xs">RPG</div>
                      </div>
                      <div className="text-center">
                        <div className="text-purple-300 font-semibold">{rec.stats.apg.toFixed(1)}</div>
                        <div className="text-slate-400 text-xs">APG</div>
                      </div>
                      <div className="text-center">
                        <div className="text-yellow-300 font-semibold">{rec.stats.spg.toFixed(1)}</div>
                        <div className="text-slate-400 text-xs">STL</div>
                      </div>
                      <div className="text-center">
                        <div className="text-red-300 font-semibold">{rec.stats.bpg.toFixed(1)}</div>
                        <div className="text-slate-400 text-xs">BLK</div>
                      </div>
                      <div className="text-center">
                        <div className="text-cyan-300 font-semibold">{rec.stats.threepm.toFixed(1)}</div>
                        <div className="text-slate-400 text-xs">3PM</div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-300 font-semibold">
                          {(rec.stats.fgPct * 100).toFixed(1)}%
                        </div>
                        <div className="text-slate-400 text-xs">FG%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-300 font-semibold">
                          {(rec.stats.ftPct * 100).toFixed(1)}%
                        </div>
                        <div className="text-slate-400 text-xs">FT%</div>
                      </div>
                    </div>

                    <div className="bg-orange-900/20 border border-orange-600/50 p-3 rounded">
                      <div className="flex items-start gap-2">
                        <div className="text-orange-400 font-semibold text-sm">補強優勢:</div>
                        <div className="flex-1">
                          <div className="flex flex-wrap gap-2 mb-2">
                            {rec.strengthens.map((cat, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-orange-600 text-white rounded text-xs font-semibold"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                          <div className="text-sm text-slate-300">{rec.reason}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
