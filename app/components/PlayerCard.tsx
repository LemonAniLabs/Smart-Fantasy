'use client'

import { useEffect, useState } from 'react'

interface PlayerCardProps {
  playerName: string
  yahooPlayerKey: string
  onClose: () => void
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

export default function PlayerCard({ playerName, yahooPlayerKey, onClose }: PlayerCardProps) {
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPlayerDetails()
  }, [playerName])

  const fetchPlayerDetails = async () => {
    setLoading(true)
    try {
      // Fetch NBA stats
      const response = await fetch('/api/nba/stats?season=2025')
      const data = await response.json()

      if (data.stats && data.stats[playerName]) {
        setStats(data.stats[playerName])
      }
    } catch (error) {
      console.error('Error fetching player details:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get player headshot URL (NBA uses player ID, we'll use a generic placeholder for now)
  const getPlayerImageUrl = (name: string) => {
    // For now, return a placeholder
    // In future, we can map Yahoo player IDs to NBA player IDs for actual headshots
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=200&background=7c3aed&color=fff&bold=true`
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-purple-500/30 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-900 to-slate-900 p-4 flex justify-between items-center border-b border-purple-500/30">
          <h3 className="text-xl font-bold text-white">Player Details</h3>
          <button
            onClick={onClose}
            className="text-purple-200 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            <p className="text-purple-200 mt-4">Loading player data...</p>
          </div>
        ) : stats ? (
          <div className="p-6 space-y-6">
            {/* Player Header */}
            <div className="flex items-start gap-6">
              <img
                src={getPlayerImageUrl(stats.name)}
                alt={stats.name}
                className="w-32 h-32 rounded-lg border-2 border-purple-500"
              />
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-white">{stats.name}</h2>
                <div className="flex gap-3 mt-2 text-sm">
                  <span className="px-3 py-1 bg-purple-900/50 border border-purple-600 rounded text-purple-200">
                    {stats.team}
                  </span>
                  <span className="px-3 py-1 bg-blue-900/50 border border-blue-600 rounded text-blue-200">
                    {stats.position}
                  </span>
                  <span className="px-3 py-1 bg-slate-700 border border-slate-600 rounded text-slate-200">
                    {stats.gamesPlayed} GP
                  </span>
                </div>
              </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-800/50 p-4 rounded-lg border border-blue-500/30">
                <div className="text-blue-300 text-sm font-medium">Points</div>
                <div className="text-3xl font-bold text-white mt-1">{stats.ppg.toFixed(1)}</div>
                <div className="text-xs text-slate-400">per game</div>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-green-500/30">
                <div className="text-green-300 text-sm font-medium">Rebounds</div>
                <div className="text-3xl font-bold text-white mt-1">{stats.rpg.toFixed(1)}</div>
                <div className="text-xs text-slate-400">per game</div>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/30">
                <div className="text-purple-300 text-sm font-medium">Assists</div>
                <div className="text-3xl font-bold text-white mt-1">{stats.apg.toFixed(1)}</div>
                <div className="text-xs text-slate-400">per game</div>
              </div>
            </div>

            {/* Detailed Stats */}
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <h4 className="text-white font-semibold mb-3">Season Statistics</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Steals</span>
                  <span className="text-yellow-300 font-medium">{stats.spg.toFixed(1)} per game</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Blocks</span>
                  <span className="text-red-300 font-medium">{stats.bpg.toFixed(1)} per game</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Turnovers</span>
                  <span className="text-orange-300 font-medium">{stats.tpg.toFixed(1)} per game</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">3-Pointers</span>
                  <span className="text-cyan-300 font-medium">{stats.threepm.toFixed(1)} per game</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">FG%</span>
                  <span className="text-white font-medium">{(stats.fgPct * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">FT%</span>
                  <span className="text-white font-medium">{(stats.ftPct * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Performance Indicators */}
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <h4 className="text-white font-semibold mb-3">Performance Analysis</h4>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Scoring Impact</span>
                    <span className="text-white">{Math.min(100, (stats.ppg / 30) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (stats.ppg / 30) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Rebounding</span>
                    <span className="text-white">{Math.min(100, (stats.rpg / 12) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (stats.rpg / 12) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Playmaking</span>
                    <span className="text-white">{Math.min(100, (stats.apg / 10) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (stats.apg / 10) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Shooting Efficiency</span>
                    <span className="text-white">{(stats.fgPct * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-cyan-600 h-2 rounded-full"
                      style={{ width: `${stats.fgPct * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fantasy Value Indicators */}
            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-4 rounded-lg border border-purple-500/30">
              <h4 className="text-white font-semibold mb-2">Fantasy Value</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-400">Strong Categories:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {stats.ppg > 15 && (
                      <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded text-xs">PTS</span>
                    )}
                    {stats.rpg > 7 && (
                      <span className="px-2 py-0.5 bg-green-900/50 text-green-300 rounded text-xs">REB</span>
                    )}
                    {stats.apg > 5 && (
                      <span className="px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded text-xs">AST</span>
                    )}
                    {stats.spg > 1 && (
                      <span className="px-2 py-0.5 bg-yellow-900/50 text-yellow-300 rounded text-xs">STL</span>
                    )}
                    {stats.bpg > 1 && (
                      <span className="px-2 py-0.5 bg-red-900/50 text-red-300 rounded text-xs">BLK</span>
                    )}
                    {stats.threepm > 2 && (
                      <span className="px-2 py-0.5 bg-cyan-900/50 text-cyan-300 rounded text-xs">3PM</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Games Played:</span>
                  <div className="mt-1">
                    <span className="text-white font-medium">{stats.gamesPlayed} games</span>
                    <span className="text-slate-400 text-xs ml-2">
                      ({((stats.gamesPlayed / 82) * 100).toFixed(0)}% of season)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-slate-400">No stats available for {playerName}</p>
            <p className="text-xs text-slate-500 mt-2">
              Player might not have enough games played this season
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
