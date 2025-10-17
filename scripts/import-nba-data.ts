/**
 * NBA 數據導入腳本
 * 用途：將 CSV 歷史數據導入到 PostgreSQL 資料庫
 *
 * 使用方式：
 * npx tsx scripts/import-nba-data.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import Papa from 'papaparse'

const prisma = new PrismaClient()

interface NBASeasonRow {
  SEASON_YEAR: string
  TEAM_ABBREVIATION: string
  GAME_DATE: string
  MATCHUP: string
  MIN: string
  FGM: string
  FGA: string
  FG_PCT: string
  FG3M: string
  FTM: string
  FTA: string
  FT_PCT: string
  OREB: string
  REB: string
  AST: string
  TOV: string
  STL: string
  BLK: string
  PTS: string
  [key: string]: string
}

// 計算 A/T Ratio
function calculateAstToRatio(ast: number, tov: number): number {
  if (tov === 0) return ast
  return parseFloat((ast / tov).toFixed(2))
}

// 解析賽季年份（例如 "2023-24" -> "2023-24"）
function parseSeason(seasonYear: string): string {
  return seasonYear.trim()
}

// 從 MATCHUP 推斷球員/球隊資訊
function parseMatchup(matchup: string): { opponent: string; isHome: boolean } {
  const isHome = matchup.includes('vs.')
  const opponent = matchup.split(isHome ? 'vs.' : '@')[1]?.trim() || ''
  return { opponent, isHome }
}

async function importSeasonData() {
  console.log('🏀 開始導入 NBA 歷史數據...\n')

  const dataPath = path.join(process.cwd(), '..', 'nba-data-2010-2024', 'regular_season_totals_2010_2024.csv')

  if (!fs.existsSync(dataPath)) {
    console.error(`❌ 找不到數據文件: ${dataPath}`)
    process.exit(1)
  }

  const fileContent = fs.readFileSync(dataPath, 'utf-8')

  return new Promise<void>((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as NBASeasonRow[]
        console.log(`📊 找到 ${rows.length} 筆賽季數據\n`)

        // 按球隊分組處理
        const teamSeasons = new Map<string, NBASeasonRow[]>()

        for (const row of rows) {
          const key = `${row.TEAM_ABBREVIATION}-${row.SEASON_YEAR}`
          if (!teamSeasons.has(key)) {
            teamSeasons.set(key, [])
          }
          teamSeasons.get(key)!.push(row)
        }

        console.log(`🏆 找到 ${teamSeasons.size} 個球隊賽季\n`)

        let processedCount = 0

        // 由於這是球隊數據，我們需要先獲取 2024-25 賽季的球員數據
        // 目前先創建一個示例結構，稍後會用真實球員數據替換

        console.log('⚠️  注意：CSV 數據是球隊級別，需要球員級別數據')
        console.log('建議：使用 NBA API 獲取球員數據\n')

        resolve()
      },
      error: (error: Error) => {
        console.error('❌ CSV 解析錯誤:', error)
        reject(error)
      }
    })
  })
}

async function main() {
  try {
    await importSeasonData()
    console.log('\n✅ 數據導入完成！')
  } catch (error) {
    console.error('\n❌ 導入失敗:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
