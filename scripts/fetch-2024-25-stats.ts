/**
 * 從 BallDontLie API 獲取 2024-25 賽季球員數據
 * API文檔: https://docs.balldontlie.io
 */

import * as fs from 'fs'
import * as path from 'path'
import type { PlayerStats } from '../lib/calculate-player-values'

const API_BASE = 'https://api.balldontlie.io/v1'

interface BallDontLiePlayer {
  id: number
  first_name: string
  last_name: string
  position: string
  team: {
    id: number
    abbreviation: string
    city: string
    conference: string
    division: string
    full_name: string
    name: string
  }
}

interface BallDontLieSeasonAverage {
  season: number
  player_id: number
  games_played: number
  min: string
  fgm: number
  fga: number
  fg3m: number
  fg3a: number
  ftm: number
  fta: number
  oreb: number
  dreb: number
  reb: number
  ast: number
  stl: number
  blk: number
  turnover: number
  pf: number
  pts: number
  fg_pct: number
  fg3_pct: number
  ft_pct: number
}

interface CombinedPlayerData extends BallDontLiePlayer {
  season_averages: BallDontLieSeasonAverage
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPlayers(): Promise<BallDontLiePlayer[]> {
  console.log('📥 正在獲取球員列表...')

  const allPlayers: BallDontLiePlayer[] = []
  let cursor = 0
  let hasMore = true

  while (hasMore) {
    const url = `${API_BASE}/players?per_page=100&cursor=${cursor}`

    console.log(`  獲取頁面 ${Math.floor(cursor / 100) + 1}...`)

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    allPlayers.push(...data.data)

    if (data.meta && data.meta.next_cursor) {
      cursor = data.meta.next_cursor
      await sleep(500) // 避免超過 rate limit
    } else {
      hasMore = false
    }
  }

  console.log(`✅ 找到 ${allPlayers.length} 位球員`)
  return allPlayers
}

async function fetchSeasonAverages(playerIds: number[]): Promise<Map<number, BallDontLieSeasonAverage>> {
  console.log('\n📊 正在獲取 2024-25 賽季平均數據...')

  const seasonAverages = new Map<number, BallDontLieSeasonAverage>()
  const batchSize = 25 // 每次請求 25 位球員

  for (let i = 0; i < playerIds.length; i += batchSize) {
    const batch = playerIds.slice(i, i + batchSize)
    const idsParam = batch.join(',')

    const url = `${API_BASE}/season_averages?season=2024&player_ids[]=${idsParam}`

    console.log(`  處理球員 ${i + 1}-${Math.min(i + batchSize, playerIds.length)} / ${playerIds.length}`)

    try {
      const response = await fetch(url)
      if (!response.ok) {
        console.warn(`  ⚠️  API 錯誤: ${response.status}`)
        await sleep(1000)
        continue
      }

      const data = await response.json()

      if (data.data && Array.isArray(data.data)) {
        data.data.forEach((avg: BallDontLieSeasonAverage) => {
          seasonAverages.set(avg.player_id, avg)
        })
      }

      await sleep(600) // 避免 rate limit (免費版限制)
    } catch (error) {
      console.error(`  ❌ 錯誤:`, error)
      await sleep(2000)
    }
  }

  console.log(`✅ 獲得 ${seasonAverages.size} 位球員的賽季數據`)
  return seasonAverages
}

async function main() {
  console.log('🏀 開始獲取 2024-25 NBA 賽季數據...\n')

  // 1. 獲取所有球員
  const players = await fetchPlayers()

  // 2. 獲取賽季平均數據
  const playerIds = players.map(p => p.id)
  const seasonAverages = await fetchSeasonAverages(playerIds)

  // 3. 合併數據並轉換格式
  const playerStats: PlayerStats[] = []

  players.forEach(player => {
    const avg = seasonAverages.get(player.id)

    if (!avg || avg.games_played < 5) {
      return // 過濾掉沒數據或出賽太少的球員
    }

    const fgPct = avg.fg_pct || 0
    const ftPct = avg.ft_pct || 0
    const astToRatio = avg.turnover > 0 ? avg.ast / avg.turnover : avg.ast

    playerStats.push({
      name: `${player.first_name} ${player.last_name}`,
      team: player.team.abbreviation,
      position: player.position || 'F',
      gamesPlayed: avg.games_played,
      fgm: avg.fgm,
      fga: avg.fga,
      fgPct: fgPct,
      ftm: avg.ftm,
      fta: avg.fta,
      ftPct: ftPct,
      tpm: avg.fg3m,
      pts: avg.pts,
      oreb: avg.oreb,
      reb: avg.reb,
      ast: avg.ast,
      stl: avg.stl,
      blk: avg.blk,
      tov: avg.turnover,
      astToRatio: astToRatio,
    })
  })

  console.log(`\n📊 處理完成: ${playerStats.length} 位合格球員（至少 5 場出賽）`)

  // 4. 顯示 Top 10
  const sorted = playerStats.sort((a, b) => b.pts - a.pts)
  console.log('\n🏆 Top 10 得分球員:')
  sorted.slice(0, 10).forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} (${p.team}) - ${p.pts.toFixed(1)} PPG, ${p.reb.toFixed(1)} RPG, ${p.ast.toFixed(1)} APG`)
  })

  // 5. 儲存數據
  const outputPath = path.join(process.cwd(), 'data', 'player-stats-2024-25.json')
  fs.writeFileSync(outputPath, JSON.stringify(playerStats, null, 2))
  console.log(`\n💾 數據已儲存至: ${outputPath}`)
}

main().catch(console.error)
