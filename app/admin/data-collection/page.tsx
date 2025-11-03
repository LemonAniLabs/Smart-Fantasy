'use client'

import { useState } from 'react'

interface CollectionLog {
  message: string
  type: 'info' | 'success' | 'error' | 'progress'
}

export default function DataCollectionPage() {
  const [logs, setLogs] = useState<CollectionLog[]>([])
  const [isCollecting, setIsCollecting] = useState(false)
  const [leagueKey, setLeagueKey] = useState('466.l.100936')
  const [season, setSeason] = useState('2024-25')
  const [maxPlayers, setMaxPlayers] = useState(5)

  const addLog = (message: string, type: CollectionLog['type'] = 'info') => {
    setLogs(prev => [...prev, { message, type }])
  }

  const startCollection = async () => {
    setLogs([])
    setIsCollecting(true)

    try {
      addLog('🏀 開始資料收集...', 'info')
      addLog(`聯盟: ${leagueKey}`, 'info')
      addLog(`賽季: ${season}`, 'info')
      addLog(`最多球員數: ${maxPlayers}`, 'info')
      addLog('', 'info')

      // Step 1: Get players
      addLog('📋 步驟 1: 獲取球員列表...', 'info')
      const playersRes = await fetch(`/api/yahoo/league-players?leagueKey=${leagueKey}`)

      if (!playersRes.ok) {
        throw new Error(`獲取球員失敗: ${playersRes.status}`)
      }

      const playersData = await playersRes.json()
      const allPlayers = playersData.players || []
      const players = maxPlayers > 0 ? allPlayers.slice(0, maxPlayers) : allPlayers

      addLog(`✓ 找到 ${allPlayers.length} 個球員`, 'success')
      addLog(`ℹ️  處理 ${players.length} 個球員`, 'info')
      addLog('', 'info')

      // Stats
      const totalStats = {
        processed: 0,
        newGames: 0,
        existingGames: 0,
        apiCalls: 0,
        errors: 0
      }

      // Step 2: Collect data for each player
      for (let i = 0; i < players.length; i++) {
        const player = players[i]
        addLog(`[${i+1}/${players.length}] ${player.name.full} (${player.player_key})`, 'progress')

        try {
          let status = 'partial'
          let playerNewGames = 0
          let playerExistingGames = 0
          let playerApiCalls = 0

          while (status === 'partial') {
            const response = await fetch(
              `/api/yahoo/backfill-player-season?playerKey=${player.player_key}&season=${season}&batchSize=50`
            )

            if (!response.ok) {
              throw new Error(`API 錯誤: ${response.status}`)
            }

            const data = await response.json()
            status = data.status

            playerNewGames += data.results?.newGames || 0
            playerExistingGames = data.results?.existingGames || 0
            playerApiCalls += data.results?.apiCalls || 0

            if (status === 'partial') {
              addLog(`  繼續收集... (已新增 ${playerNewGames} 場)`, 'info')
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          }

          addLog(`  ✓ 已存在: ${playerExistingGames} 場, 新增: ${playerNewGames} 場, API: ${playerApiCalls} 次`, 'success')

          totalStats.processed++
          totalStats.newGames += playerNewGames
          totalStats.existingGames += playerExistingGames
          totalStats.apiCalls += playerApiCalls

        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          addLog(`  ✗ 錯誤: ${message}`, 'error')
          totalStats.errors++
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Final stats
      addLog('', 'info')
      addLog('='.repeat(60), 'info')
      addLog('✅ 回填完成！', 'success')
      addLog('='.repeat(60), 'info')
      addLog(`處理球員: ${totalStats.processed}/${players.length}`, 'info')
      addLog(`新增比賽: ${totalStats.newGames} 場`, 'info')
      addLog(`已存在比賽: ${totalStats.existingGames} 場`, 'info')
      addLog(`API 調用: ${totalStats.apiCalls} 次`, 'info')
      addLog(`錯誤: ${totalStats.errors} 個`, 'info')
      addLog('='.repeat(60), 'info')

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      addLog(`✗ 錯誤: ${message}`, 'error')
    } finally {
      setIsCollecting(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">資料收集工具</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">設定</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">聯盟 Key</label>
            <input
              type="text"
              value={leagueKey}
              onChange={(e) => setLeagueKey(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              disabled={isCollecting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">賽季</label>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              disabled={isCollecting}
            >
              <option value="2024-25">2024-25</option>
              <option value="2025-26">2025-26</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              最多球員數 (0 = 全部)
            </label>
            <input
              type="number"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-md"
              disabled={isCollecting}
              min="0"
            />
          </div>

          <button
            onClick={startCollection}
            disabled={isCollecting}
            className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isCollecting ? '收集中...' : '開始收集'}
          </button>
        </div>
      </div>

      <div className="bg-gray-900 text-gray-100 rounded-lg shadow-md p-6 font-mono text-sm overflow-auto max-h-[600px]">
        <h2 className="text-xl font-semibold mb-4">執行日誌</h2>

        {logs.length === 0 && (
          <p className="text-gray-400">點擊「開始收集」以開始...</p>
        )}

        {logs.map((log, index) => (
          <div
            key={index}
            className={`mb-1 ${
              log.type === 'error' ? 'text-red-400' :
              log.type === 'success' ? 'text-green-400' :
              log.type === 'progress' ? 'text-yellow-400 font-bold' :
              'text-gray-300'
            }`}
          >
            {log.message}
          </div>
        ))}
      </div>
    </div>
  )
}
