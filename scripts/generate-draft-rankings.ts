/**
 * 生成選秀排名與價值評估
 */

import * as fs from 'fs'
import * as path from 'path'
import { calculatePlayerValues, type PlayerStats } from '../lib/calculate-player-values'

async function main() {
  console.log('📊 開始計算選秀價值...\n')

  const statsPath = path.join(process.cwd(), 'data', 'player-stats-2023-24.json')

  if (!fs.existsSync(statsPath)) {
    console.error(`❌ 找不到球員數據文件: ${statsPath}`)
    console.error('請先執行: npx tsx scripts/process-player-stats.ts')
    process.exit(1)
  }

  const playerStats: PlayerStats[] = JSON.parse(fs.readFileSync(statsPath, 'utf-8'))
  console.log(`✅ 載入 ${playerStats.length} 位球員數據`)

  console.log('\n🧮 計算 Z-Score 與選秀價值...')
  const playerValues = calculatePlayerValues(playerStats)

  console.log(`\n🏆 Top 20 選秀排名 (11-Cat H2H):\n`)
  playerValues.slice(0, 20).forEach((player, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${player.name.padEnd(25)} ${player.team.padEnd(3)} | 建議價格: $${player.suggestedPrice.toString().padStart(3)} (${player.minPrice}-${player.maxPrice}) | VORP: ${player.vorp.toFixed(2)}`)

    // 顯示強項類別
    const topCategories = Object.entries(player.categoryScores)
      .filter(([_, score]) => score >= 7)
      .map(([cat, score]) => `${cat.toUpperCase()}(${score.toFixed(1)})`)
      .join(', ')

    if (topCategories) {
      console.log(`    強項: ${topCategories}`)
    }
  })

  // 輸出完整排名
  const outputPath = path.join(process.cwd(), 'data', 'draft-rankings-2024-25.json')
  fs.writeFileSync(outputPath, JSON.stringify(playerValues, null, 2))
  console.log(`\n💾 完整排名已儲存至: ${outputPath}`)

  // 生成各位置 Top 10
  const positions = ['PG', 'SG', 'SF', 'PF', 'C']

  console.log('\n\n📋 各位置 Top 10:\n')

  positions.forEach(pos => {
    const posPlayers = playerValues
      .filter(p => p.position && p.position.includes(pos))
      .slice(0, 10)

    console.log(`\n${pos}:`)
    posPlayers.forEach((p, i) => {
      console.log(`  ${(i + 1).toString().padStart(2)}. ${p.name.padEnd(25)} - $${p.suggestedPrice.toString().padStart(3)}`)
    })
  })

  console.log('\n✅ 完成！')
}

main().catch(console.error)
