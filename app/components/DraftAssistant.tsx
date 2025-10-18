'use client'

import { useState, useEffect, useMemo } from 'react'
import type { PlayerValue } from '@/lib/calculate-player-values'

type SortField = 'rank' | 'name' | 'team' | 'position' | 'price' | 'vorp'
type SortDirection = 'asc' | 'desc'

export default function DraftAssistant() {
  const [players, setPlayers] = useState<PlayerValue[]>([])
  const [loading, setLoading] = useState(true)
  const [budget, setBudget] = useState(200)
  const [rosterSpots, setRosterSpots] = useState(16)
  const [draftedPlayers, setDraftedPlayers] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [positionFilter, setPositionFilter] = useState<string>('ALL')
  const [sortField, setSortField] = useState<SortField>('rank')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [ignoreBudget, setIgnoreBudget] = useState(false)

  useEffect(() => {
    // Load draft rankings data
    fetch('/data/draft-rankings-2024-25.json')
      .then(res => res.json())
      .then(data => {
        setPlayers(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load rankings:', err)
        setLoading(false)
      })
  }, [])

  const handleDraft = (playerName: string, price: number) => {
    // Prevent duplicate selection
    if (draftedPlayers.has(playerName)) {
      console.warn('Player already drafted:', playerName)
      return
    }

    setDraftedPlayers(prev => new Set([...prev, playerName]))

    // Only deduct budget when not ignoring budget limit
    if (!ignoreBudget) {
      setBudget(prev => Math.max(0, prev - price))
    }

    setRosterSpots(prev => Math.max(0, prev - 1))
  }

  const handleUndraft = (playerName: string, price: number) => {
    setDraftedPlayers(prev => {
      const newSet = new Set(prev)
      newSet.delete(playerName)
      return newSet
    })
    setBudget(prev => Math.min(200, prev + price))
    setRosterSpots(prev => Math.min(16, prev + 1))
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const filteredPlayers = useMemo(() => {
    const filtered = players.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           p.team?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesPosition = positionFilter === 'ALL' ||
                             (p.position && p.position === positionFilter)
      const notDrafted = !draftedPlayers.has(p.name)
      return matchesSearch && matchesPosition && notDrafted
    })

    // Sort - create a new sorted array
    const sorted = [...filtered].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number

      switch (sortField) {
        case 'rank':
          aVal = a.overallRank
          bVal = b.overallRank
          break
        case 'name':
          aVal = a.name
          bVal = b.name
          break
        case 'team':
          aVal = a.team
          bVal = b.team
          break
        case 'position':
          aVal = a.position
          bVal = b.position
          break
        case 'price':
          aVal = a.suggestedPrice
          bVal = b.suggestedPrice
          break
        case 'vorp':
          aVal = a.vorp
          bVal = b.vorp
          break
        default:
          aVal = a.overallRank
          bVal = b.overallRank
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      } else {
        return sortDirection === 'asc'
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number)
      }
    })

    return sorted
  }, [players, searchTerm, positionFilter, draftedPlayers, sortField, sortDirection])

  const myTeam = useMemo(() => {
    return players.filter(p => draftedPlayers.has(p.name))
  }, [players, draftedPlayers])

  const avgPerSpot = Math.floor(budget / Math.max(1, rosterSpots))

  if (loading) {
    return <div className="text-white text-center">Loading draft data...</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Draft Board */}
      <div className="lg:col-span-2">
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Available Players ({filteredPlayers.length})</h2>
              <div className="flex gap-4 items-center">
                <select
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                  className="bg-slate-800 text-white px-4 py-2 rounded-lg border border-purple-500"
                >
                  <option value="ALL">All Positions</option>
                  <option value="PG">Point Guard (PG)</option>
                  <option value="SG">Shooting Guard (SG)</option>
                  <option value="SF">Small Forward (SF)</option>
                  <option value="PF">Power Forward (PF)</option>
                  <option value="C">Center (C)</option>
                </select>
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-800 text-white px-4 py-2 rounded-lg border border-purple-500 w-64"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={ignoreBudget}
                  onChange={(e) => setIgnoreBudget(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="text-sm">Ignore Budget Limit</span>
              </label>
              <span className="text-xs text-gray-400">
                - Select any player without budget restrictions
              </span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800 text-white">
                <tr>
                  <th
                    className="text-left p-2 cursor-pointer hover:bg-slate-700"
                    onClick={() => handleSort('rank')}
                  >
                    Rank {sortField === 'rank' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer hover:bg-slate-700"
                    onClick={() => handleSort('name')}
                  >
                    Player {sortField === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer hover:bg-slate-700"
                    onClick={() => handleSort('team')}
                  >
                    Team {sortField === 'team' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer hover:bg-slate-700"
                    onClick={() => handleSort('position')}
                  >
                    Pos {sortField === 'position' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    className="text-right p-2 cursor-pointer hover:bg-slate-700"
                    onClick={() => handleSort('price')}
                  >
                    Price {sortField === 'price' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    className="text-right p-2 cursor-pointer hover:bg-slate-700"
                    onClick={() => handleSort('vorp')}
                  >
                    VORP {sortField === 'vorp' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="text-left p-2">Strengths</th>
                  <th className="text-center p-2">Action</th>
                </tr>
              </thead>
              <tbody className="text-white">
                {filteredPlayers.map((player) => {
                  const topCats = Object.entries(player.categoryScores)
                    .filter(([, score]) => score >= 7)
                    .map(([cat]) => cat.toUpperCase())
                    .slice(0, 4)
                    .join(', ')

                  const canAfford = ignoreBudget || player.suggestedPrice <= budget
                  const alreadyDrafted = draftedPlayers.has(player.name)

                  return (
                    <tr
                      key={player.name}
                      className={`border-b border-slate-700 hover:bg-white/5 ${
                        !canAfford ? 'opacity-40' : ''
                      }`}
                    >
                      <td className="p-2 font-bold text-purple-300">#{player.overallRank}</td>
                      <td className="p-2 font-semibold">{player.name}</td>
                      <td className="p-2">{player.team}</td>
                      <td className="p-2 text-xs">{player.position}</td>
                      <td className="p-2 text-right">
                        <span className="text-green-400 font-bold">${player.suggestedPrice}</span>
                        <span className="text-xs text-gray-400 ml-1">
                          (${player.minPrice}-${player.maxPrice})
                        </span>
                      </td>
                      <td className="p-2 text-right text-xs">{player.vorp.toFixed(1)}</td>
                      <td className="p-2 text-xs text-purple-200">{topCats || '-'}</td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleDraft(player.name, player.suggestedPrice)}
                          disabled={!canAfford || rosterSpots === 0 || alreadyDrafted}
                          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-1 rounded text-xs font-semibold"
                        >
                          {alreadyDrafted ? 'Drafted' : 'Draft'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right: My Team & Budget */}
      <div className="space-y-6">
        {/* Budget Info */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Draft Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-purple-200">Remaining Budget:</span>
              <span className="text-3xl font-bold text-green-400">${budget}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-purple-200">Roster Spots:</span>
              <span className="text-2xl font-bold text-blue-400">{rosterSpots} / 16</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-purple-200">Avg per Spot:</span>
              <span className="text-xl font-bold text-yellow-400">${avgPerSpot}</span>
            </div>
          </div>
        </div>

        {/* My Team */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">My Team ({myTeam.length})</h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {myTeam.length === 0 ? (
              <p className="text-gray-400 text-sm italic">No players drafted yet</p>
            ) : (
              myTeam.map((player) => (
                <div
                  key={player.name}
                  className="bg-slate-800/50 p-3 rounded flex justify-between items-center"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-white">{player.name}</div>
                    <div className="text-xs text-purple-200">
                      {player.team} | {player.position}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 font-bold">${player.suggestedPrice}</span>
                    <button
                      onClick={() => handleUndraft(player.name, player.suggestedPrice)}
                      className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Category Coverage */}
        {myTeam.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">Category Coverage</h3>
            <div className="space-y-2 text-sm">
              {[
                { key: 'fgm', label: 'FGM', fullName: 'Field Goals Made' },
                { key: 'fgPct', label: 'FG%', fullName: 'Field Goal Percentage' },
                { key: 'ftPct', label: 'FT%', fullName: 'Free Throw Percentage' },
                { key: 'tpm', label: '3PM', fullName: '3-Pointers Made' },
                { key: 'pts', label: 'PTS', fullName: 'Points Scored' },
                { key: 'oreb', label: 'OREB', fullName: 'Offensive Rebounds' },
                { key: 'reb', label: 'REB', fullName: 'Total Rebounds' },
                { key: 'ast', label: 'AST', fullName: 'Assists' },
                { key: 'stl', label: 'STL', fullName: 'Steals' },
                { key: 'blk', label: 'BLK', fullName: 'Blocks' },
                { key: 'astToRatio', label: 'A/T', fullName: 'Assist/Turnover Ratio' },
              ].map(cat => {
                const avgScore = myTeam.reduce((sum, p) => sum + p.categoryScores[cat.key as keyof typeof p.categoryScores], 0) / myTeam.length
                const barWidth = (avgScore / 10) * 100

                return (
                  <div key={cat.key}>
                    <div className="flex justify-between text-purple-200 mb-1">
                      <span
                        className="uppercase text-xs font-semibold cursor-help"
                        title={cat.fullName}
                      >
                        {cat.label}
                      </span>
                      <span>{avgScore.toFixed(1)}/10</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          avgScore >= 7 ? 'bg-green-500' : avgScore >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
