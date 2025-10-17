/**
 * 處理 NBA Box Score 數據
 * 計算 2023-24 賽季球員平均數據
 */

import * as fs from 'fs'
import * as path from 'path'
import Papa from 'papaparse'
import type { PlayerStats } from '../lib/calculate-player-values'

interface BoxScoreRow {
  season_year: string
  personId: string
  personName: string
  teamTricode: string
  position: string
  minutes: string
  fieldGoalsMade: string
  fieldGoalsAttempted: string
  fieldGoalsPercentage: string
  threePointersMade: string
  freeThrowsMade: string
  freeThrowsAttempted: string
  freeThrowsPercentage: string
  reboundsOffensive: string
  reboundsTotal: string
  assists: string
  steals: string
  blocks: string
  turnovers: string
  points: string
}

async function processBoxScores(csvFilePath: string): Promise<Map<string, PlayerStats>> {
  const fileContent = fs.readFileSync(csvFilePath, 'utf-8')
  const playerStatsMap = new Map<string, {
    games: number
    totalStats: {
      fgm: number
      fga: number
      ftm: number
      fta: number
      tpm: number
      pts: number
      oreb: number
      reb: number
      ast: number
      stl: number
      blk: number
      tov: number
    }
    team: string
    position: string
  }>()

  return new Promise((resolve) => {
    Papa.parse<BoxScoreRow>(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data

        rows.forEach(row => {
          // 只處理 2023-24 賽季並且有上場時間的數據
          if (row.season_year !== '2023-24' || !row.minutes || row.minutes === '' || row.minutes === '0') {
            return
          }

          const playerId = row.personId
          const playerName = row.personName

          if (!playerId || !playerName) return

          // 解析數據
          const fgm = parseFloat(row.fieldGoalsMade) || 0
          const fga = parseFloat(row.fieldGoalsAttempted) || 0
          const ftm = parseFloat(row.freeThrowsMade) || 0
          const fta = parseFloat(row.freeThrowsAttempted) || 0
          const tpm = parseFloat(row.threePointersMade) || 0
          const pts = parseFloat(row.points) || 0
          const oreb = parseFloat(row.reboundsOffensive) || 0
          const reb = parseFloat(row.reboundsTotal) || 0
          const ast = parseFloat(row.assists) || 0
          const stl = parseFloat(row.steals) || 0
          const blk = parseFloat(row.blocks) || 0
          const tov = parseFloat(row.turnovers) || 0

          // 初始化或更新球員數據
          if (!playerStatsMap.has(playerId)) {
            playerStatsMap.set(playerId, {
              games: 0,
              totalStats: {
                fgm: 0,
                fga: 0,
                ftm: 0,
                fta: 0,
                tpm: 0,
                pts: 0,
                oreb: 0,
                reb: 0,
                ast: 0,
                stl: 0,
                blk: 0,
                tov: 0,
              },
              team: row.teamTricode,
              position: row.position || 'G-F',
            })
          }

          const playerData = playerStatsMap.get(playerId)!
          playerData.games += 1
          playerData.totalStats.fgm += fgm
          playerData.totalStats.fga += fga
          playerData.totalStats.ftm += ftm
          playerData.totalStats.fta += fta
          playerData.totalStats.tpm += tpm
          playerData.totalStats.pts += pts
          playerData.totalStats.oreb += oreb
          playerData.totalStats.reb += reb
          playerData.totalStats.ast += ast
          playerData.totalStats.stl += stl
          playerData.totalStats.blk += blk
          playerData.totalStats.tov += tov
        })

        // 計算平均值
        const finalStats = new Map<string, PlayerStats>()

        playerStatsMap.forEach((data, playerId) => {
          const games = data.games
          const totals = data.totalStats

          const fgPct = totals.fga > 0 ? totals.fgm / totals.fga : 0
          const ftPct = totals.fta > 0 ? totals.ftm / totals.fta : 0
          const astToRatio = totals.tov > 0 ? totals.ast / totals.tov : totals.ast

          finalStats.set(playerId, {
            name: rows.find(r => r.personId === playerId)?.personName || '',
            team: data.team,
            position: data.position,
            gamesPlayed: games,
            fgm: totals.fgm / games,
            fga: totals.fga / games,
            fgPct: fgPct,
            ftm: totals.ftm / games,
            fta: totals.fta / games,
            ftPct: ftPct,
            tpm: totals.tpm / games,
            pts: totals.pts / games,
            oreb: totals.oreb / games,
            reb: totals.reb / games,
            ast: totals.ast / games,
            stl: totals.stl / games,
            blk: totals.blk / games,
            tov: totals.tov / games,
            astToRatio: astToRatio,
          })
        })

        resolve(finalStats)
      }
    })
  })
}

async function main() {
  console.log('🏀 開始處理 2023-24 賽季球員數據...\n')

  const dataDir = path.join(process.cwd(), '..', 'nba-data-2010-2024')
  const boxScoreFiles = [
    'regular_season_box_scores_2010_2024_part_1.csv',
    'regular_season_box_scores_2010_2024_part_2.csv',
    'regular_season_box_scores_2010_2024_part_3.csv',
  ]

  const allPlayerStats = new Map<string, PlayerStats>()

  for (const file of boxScoreFiles) {
    const filePath = path.join(dataDir, file)
    console.log(`📂 處理: ${file}`)

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  文件不存在: ${filePath}`)
      continue
    }

    const stats = await processBoxScores(filePath)
    console.log(`✅ 找到 ${stats.size} 位球員`)

    // 合併數據
    stats.forEach((playerStats, playerId) => {
      allPlayerStats.set(playerId, playerStats)
    })
  }

  console.log(`\n📊 總計: ${allPlayerStats.size} 位球員`)

  // 轉換為數組並排序
  const playerArray = Array.from(allPlayerStats.values())
    .filter(p => p.gamesPlayed >= 20)  // 至少打 20 場
    .sort((a, b) => b.pts - a.pts)  // 按得分排序

  console.log(`\n🏆 符合條件球員: ${playerArray.length} 位\n`)

  // 顯示 Top 10
  console.log('Top 10 球員（按得分）:')
  playerArray.slice(0, 10).forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} (${p.team}) - ${p.pts.toFixed(1)} PPG, ${p.reb.toFixed(1)} RPG, ${p.ast.toFixed(1)} APG`)
  })

  // 輸出為 JSON
  const outputPath = path.join(process.cwd(), 'data', 'player-stats-2023-24.json')

  // 確保目錄存在
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(outputPath, JSON.stringify(playerArray, null, 2))
  console.log(`\n💾 數據已儲存至: ${outputPath}`)
}

main().catch(console.error)
