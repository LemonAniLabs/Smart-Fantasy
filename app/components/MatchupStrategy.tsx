'use client'

import { useEffect, useState } from 'react'

interface MatchupStrategyProps {
  myTeamKey: string
  myTeamName: string
  opponentTeamKey: string
  opponentTeamName: string
}

interface Player {
  player_key: string
  name: {
    full: string
  }
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
  ppg: number
  rpg: number
  apg: number
  spg: number
  bpg: number
  threepm: number
  tpg: number
  fgPct: number
  ftPct: number
}

interface CategoryComparison {
  category: string
  myValue: number
  oppValue: number
  difference: number
  percentDiff: number
  status: 'winning' | 'close' | 'losing'
  recommendation: string
}

export default function MatchupStrategy({
  myTeamKey,
  myTeamName,
  opponentTeamKey,
  opponentTeamName,
}: MatchupStrategyProps) {
  const [loading, setLoading] = useState(true)
  const [myStats, setMyStats] = useState<TeamStats | null>(null)
  const [oppStats, setOppStats] = useState<TeamStats | null>(null)
  const [comparison, setComparison] = useState<CategoryComparison[]>([])

  useEffect(() => {
    fetchAnalysis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTeamKey, opponentTeamKey])

  const fetchAnalysis = async () => {
    setLoading(true)
    try {
      // Fetch NBA stats first
      const statsResponse = await fetch('/api/nba/stats?season=2025')
      if (!statsResponse.ok) {
        throw new Error('Failed to fetch NBA stats')
      }

      const statsData = await statsResponse.json()
      const stats = statsData.stats || {}

      // Fetch both rosters
      const [myRosterRes, oppRosterRes] = await Promise.all([
        fetch(`/api/yahoo/roster?teamKey=${myTeamKey}`),
        fetch(`/api/yahoo/roster?teamKey=${opponentTeamKey}`),
      ])

      if (!myRosterRes.ok || !oppRosterRes.ok) {
        throw new Error('Failed to fetch rosters')
      }

      const [myRosterData, oppRosterData] = await Promise.all([
        myRosterRes.json(),
        oppRosterRes.json(),
      ])

      const myRoster: Player[] = myRosterData.roster || []
      const oppRoster: Player[] = oppRosterData.roster || []

      // Calculate team stats
      const myTeamStats = calculateTeamStats(myRoster, stats)
      const oppTeamStats = calculateTeamStats(oppRoster, stats)

      setMyStats(myTeamStats)
      setOppStats(oppTeamStats)

      // Generate comparison
      const comparisonData = generateComparison(myTeamStats, oppTeamStats)
      setComparison(comparisonData)
    } catch (error) {
      console.error('Error fetching matchup analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateTeamStats = (roster: Player[], statsMap: Record<string, PlayerStats>): TeamStats => {
    let totalPPG = 0
    let totalRPG = 0
    let totalAPG = 0
    let totalSPG = 0
    let totalBPG = 0
    let total3PM = 0
    let totalTPG = 0
    let totalFGPct = 0
    let totalFTPct = 0
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
        totalTPG += stats.tpg
        totalFGPct += stats.fgPct
        totalFTPct += stats.ftPct
        playerCount++
      }
    })

    return {
      ppg: totalPPG,
      rpg: totalRPG,
      apg: totalAPG,
      spg: totalSPG,
      bpg: totalBPG,
      threepm: total3PM,
      tpg: totalTPG,
      fgPct: playerCount > 0 ? (totalFGPct / playerCount) * 100 : 0,
      ftPct: playerCount > 0 ? (totalFTPct / playerCount) * 100 : 0,
    }
  }

  const generateComparison = (myTeam: TeamStats, oppTeam: TeamStats): CategoryComparison[] => {
    const categories = [
      { key: 'ppg', name: '得分 (PTS)', higherIsBetter: true },
      { key: 'rpg', name: '籃板 (REB)', higherIsBetter: true },
      { key: 'apg', name: '助攻 (AST)', higherIsBetter: true },
      { key: 'spg', name: '抄截 (STL)', higherIsBetter: true },
      { key: 'bpg', name: '阻攻 (BLK)', higherIsBetter: true },
      { key: 'threepm', name: '三分球 (3PM)', higherIsBetter: true },
      { key: 'tpg', name: '失誤 (TO)', higherIsBetter: false },
      { key: 'fgPct', name: '投籃命中率 (FG%)', higherIsBetter: true },
      { key: 'ftPct', name: '罰球命中率 (FT%)', higherIsBetter: true },
    ]

    return categories.map((cat) => {
      const myValue = myTeam[cat.key as keyof TeamStats]
      const oppValue = oppTeam[cat.key as keyof TeamStats]
      const difference = cat.higherIsBetter ? myValue - oppValue : oppValue - myValue
      const percentDiff = oppValue !== 0 ? (difference / oppValue) * 100 : 0

      let status: 'winning' | 'close' | 'losing'
      let recommendation: string

      if (percentDiff > 10) {
        status = 'winning'
        recommendation = cat.higherIsBetter
          ? '✅ 保持優勢，繼續發揮'
          : '✅ 對手失誤更多，保持控球'
      } else if (percentDiff > -10) {
        status = 'close'
        recommendation = '⚠️ 膠著狀態，關鍵類別！需要優化陣容或尋找 Free Agent 補強'
      } else {
        status = 'losing'
        recommendation = cat.key === 'tpg'
          ? '❌ 你的失誤太多，考慮調整陣容或使用控球型球員'
          : '❌ 明顯劣勢，考慮放棄此類別，專注其他可贏類別'
      }

      return {
        category: cat.name,
        myValue,
        oppValue,
        difference,
        percentDiff,
        status,
        recommendation,
      }
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'winning':
        return 'bg-green-900/30 border-green-600'
      case 'close':
        return 'bg-yellow-900/30 border-yellow-600'
      case 'losing':
        return 'bg-red-900/30 border-red-600'
      default:
        return 'bg-slate-800/50 border-slate-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'winning':
        return '🟢'
      case 'close':
        return '🟡'
      case 'losing':
        return '🔴'
      default:
        return '⚪'
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-800/50 p-6 rounded-lg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          <p className="text-purple-200 mt-4">分析對戰數據中...</p>
        </div>
      </div>
    )
  }

  if (!myStats || !oppStats) {
    return (
      <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4 text-sm text-yellow-200">
        無法分析對戰數據。請確保雙方都有完整的球員名單。
      </div>
    )
  }

  const winningCategories = comparison.filter((c) => c.status === 'winning')
  const closeCategories = comparison.filter((c) => c.status === 'close')
  const losingCategories = comparison.filter((c) => c.status === 'losing')

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-6 rounded-lg border border-purple-500/30">
        <h4 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
          🎯 戰略分析
        </h4>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-green-900/20 border border-green-600 rounded-lg p-3 text-center">
            <div className="text-green-400 text-sm font-medium">優勢類別</div>
            <div className="text-3xl font-bold text-white mt-1">{winningCategories.length}</div>
            <div className="text-xs text-green-300 mt-1">保持領先</div>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-3 text-center">
            <div className="text-yellow-400 text-sm font-medium">膠著類別</div>
            <div className="text-3xl font-bold text-white mt-1">{closeCategories.length}</div>
            <div className="text-xs text-yellow-300 mt-1">關鍵戰場</div>
          </div>
          <div className="bg-red-900/20 border border-red-600 rounded-lg p-3 text-center">
            <div className="text-red-400 text-sm font-medium">劣勢類別</div>
            <div className="text-3xl font-bold text-white mt-1">{losingCategories.length}</div>
            <div className="text-xs text-red-300 mt-1">考慮放棄</div>
          </div>
        </div>

        <div className="bg-slate-800/50 p-4 rounded-lg">
          <h5 className="text-white font-semibold mb-2 text-sm">💡 本週戰略建議</h5>
          <ul className="space-y-2 text-sm text-purple-200">
            <li className="flex items-start gap-2">
              <span className="text-green-400">✓</span>
              <span>
                <strong>專注優勢類別:</strong> 你在 {winningCategories.map((c) => c.category.split(' ')[0]).join('、')} 有明顯優勢，
                確保這些位置的球員都在先發陣容中。
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">!</span>
              <span>
                <strong>爭取膠著類別:</strong> {closeCategories.map((c) => c.category.split(' ')[0]).join('、')} 是本週關鍵，
                考慮從 Free Agents 中尋找補強球員。
              </span>
            </li>
            {losingCategories.length > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-red-400">×</span>
                <span>
                  <strong>策略性放棄:</strong> 你在 {losingCategories.map((c) => c.category.split(' ')[0]).join('、')} 明顯落後，
                  考慮 Punt 這些類別，將資源集中在可贏類別上。
                </span>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Detailed Category Comparison */}
      <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
        <h4 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          📊 類別詳細比較
        </h4>

        <div className="space-y-3">
          {comparison.map((cat, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${getStatusColor(cat.status)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getStatusIcon(cat.status)}</span>
                  <span className="text-white font-semibold">{cat.category}</span>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${
                    cat.status === 'winning' ? 'text-green-400' :
                    cat.status === 'close' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {cat.percentDiff > 0 ? '+' : ''}{cat.percentDiff.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-green-300">{myTeamName}</span>
                    <span className="text-white font-medium">
                      {cat.category.includes('%') ? cat.myValue.toFixed(1) + '%' : cat.myValue.toFixed(1)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (cat.myValue / (cat.myValue + cat.oppValue)) * 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="text-white font-bold text-xl">VS</div>

                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-red-300">{opponentTeamName}</span>
                    <span className="text-white font-medium">
                      {cat.category.includes('%') ? cat.oppValue.toFixed(1) + '%' : cat.oppValue.toFixed(1)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-red-500 to-red-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (cat.oppValue / (cat.myValue + cat.oppValue)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="text-sm text-slate-300 bg-slate-900/50 p-2 rounded">
                {cat.recommendation}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lineup Optimization Tips */}
      <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
        <h4 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          ⚙️ 陣容優化建議
        </h4>

        <div className="space-y-3 text-sm">
          <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-3">
            <div className="text-blue-300 font-semibold mb-2">🔄 檢查先發陣容</div>
            <p className="text-slate-300">
              確保所有優勢和膠著類別的關鍵球員都在先發位置。板凳球員不會計入當週統計。
            </p>
          </div>

          <div className="bg-purple-900/20 border border-purple-600 rounded-lg p-3">
            <div className="text-purple-300 font-semibold mb-2">📅 監控比賽場次</div>
            <p className="text-slate-300">
              本週比賽場次多的球員更有價值。考慮用比賽少的球員換取本週有更多比賽的球員。
            </p>
          </div>

          <div className="bg-cyan-900/20 border border-cyan-600 rounded-lg p-3">
            <div className="text-cyan-300 font-semibold mb-2">🎯 針對性補強</div>
            <p className="text-slate-300">
              優先在膠著類別中補強。瀏覽 Free Agents 時，尋找能同時提升多個膠著類別的球員。
            </p>
          </div>

          <div className="bg-orange-900/20 border border-orange-600 rounded-lg p-3">
            <div className="text-orange-300 font-semibold mb-2">🚫 Punt 策略</div>
            <p className="text-slate-300">
              如果某些類別差距太大（超過 20%），考慮完全放棄這些類別，
              將精力集中在可以獲勝的 5-6 個類別上。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
