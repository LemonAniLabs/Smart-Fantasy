/**
 * 從 NBAStats API 獲取 2024-25 賽季球員數據
 * API文檔: https://github.com/nprasad2077/nbaStats
 * 無需 API Key
 */

import * as fs from 'fs'
import * as path from 'path'
import type { PlayerStats } from '../lib/calculate-player-values'

const API_BASE = 'https://api.server.nbaapi.com/api'

interface NBAApiPlayer {
  playerName: string
  team: string
  position: string
  games: number
  minutesPg: number
  fieldGoals: number
  fieldAttempts: number
  threeFg: number
  threeAttempts: number
  ft: number
  ftAttempts: number
  offensiveRb: number
  defensiveRb: number
  totalRb: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  personalFouls: number
  points: number
  season: number
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPlayerTotals(season: string = '2025'): Promise<NBAApiPlayer[]> {
  console.log(`📥 正在獲取 ${season} 賽季球員數據...`)

  const allPlayers: NBAApiPlayer[] = []
  let page = 1
  const pageSize = 100
  let hasMore = true

  while (hasMore) {
    const url = `${API_BASE}/playertotals?season=${season}&page=${page}&pageSize=${pageSize}`

    console.log(`  獲取第 ${page} 頁...`)

    try {
      const response = await fetch(url)

      if (!response.ok) {
        console.error(`  ❌ API錯誤: ${response.status}`)
        break
      }

      const result = await response.json()

      if (result && result.data && Array.isArray(result.data)) {
        if (result.data.length === 0) {
          hasMore = false
        } else {
          allPlayers.push(...result.data)

          // 檢查是否還有下一頁
          if (result.pagination && page < result.pagination.pages) {
            page++
            await sleep(300) // 避免請求過快
          } else {
            hasMore = false
          }
        }
      } else {
        hasMore = false
      }
    } catch (error) {
      console.error(`  ❌ 錯誤:`, error)
      hasMore = false
    }
  }

  console.log(`✅ 找到 ${allPlayers.length} 位球員`)
  return allPlayers
}

async function main() {
  console.log('🏀 開始獲取 2024-25 NBA 賽季數據...\n')

  // 1. 獲取球員數據 (2025 = 2024-25 賽季)
  const players = await fetchPlayerTotals('2025')

  if (players.length === 0) {
    console.log('\n⚠️  無法獲取 2024-25 數據，嘗試使用 2024 賽季數據...')
    const fallbackPlayers = await fetchPlayerTotals('2024')

    if (fallbackPlayers.length === 0) {
      console.error('❌ 無法獲取任何數據')
      return
    }

    players.push(...fallbackPlayers)
  }

  // 2. 轉換為我們的格式
  const playerStats: PlayerStats[] = []

  players.forEach(player => {
    if (!player.games || player.games < 20) {
      return // 過濾出賽太少的球員
    }

    const fgm = player.fieldGoals / player.games
    const fga = player.fieldAttempts / player.games
    const fgPct = fga > 0 ? fgm / fga : 0

    const ftm = player.ft / player.games
    const fta = player.ftAttempts / player.games
    const ftPct = fta > 0 ? ftm / fta : 0

    const tpm = player.threeFg / player.games
    const pts = player.points / player.games
    const oreb = player.offensiveRb / player.games
    const reb = player.totalRb / player.games
    const ast = player.assists / player.games
    const stl = player.steals / player.games
    const blk = player.blocks / player.games
    const tov = player.turnovers / player.games

    const astToRatio = tov > 0 ? ast / tov : ast

    // 保留原始細分位置（PG, SG, SF, PF, C）
    const position = player.position || 'F'

    playerStats.push({
      name: player.playerName,
      team: player.team || 'UNK',
      position: position,
      gamesPlayed: player.games,
      fgm,
      fga,
      fgPct,
      ftm,
      fta,
      ftPct,
      tpm,
      pts,
      oreb,
      reb,
      ast,
      stl,
      blk,
      tov,
      astToRatio,
    })
  })

  console.log(`\n📊 處理完成: ${playerStats.length} 位合格球員（至少 20 場出賽）`)

  // 3. 顯示 Top 10
  const sorted = playerStats.sort((a, b) => b.pts - a.pts)
  console.log('\n🏆 Top 10 得分球員:')
  sorted.slice(0, 10).forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} (${p.team}) - ${p.pts.toFixed(1)} PPG, ${p.reb.toFixed(1)} RPG, ${p.ast.toFixed(1)} APG`)
  })

  // 4. 儲存數據
  const outputPath = path.join(process.cwd(), 'data', 'player-stats-2024-25.json')
  fs.writeFileSync(outputPath, JSON.stringify(playerStats, null, 2))
  console.log(`\n💾 數據已儲存至: ${outputPath}`)

  console.log('\n✅ 完成！現在可以執行：npx tsx scripts/generate-draft-rankings-2024-25.ts')
}

main().catch(console.error)
