/**
 * 選秀價值計算引擎
 * 針對 11-Cat H2H 聯盟優化
 */

export interface PlayerStats {
  name: string
  team: string
  position: string
  gamesPlayed: number

  // 11 Categories
  fgm: number      // Field Goals Made
  fga: number      // Field Goals Attempted
  fgPct: number    // FG%
  ftm: number      // Free Throws Made
  fta: number      // Free Throws Attempted
  ftPct: number    // FT%
  tpm: number      // 3-Pointers Made
  pts: number      // Points
  oreb: number     // Offensive Rebounds
  reb: number      // Total Rebounds
  ast: number      // Assists
  stl: number      // Steals
  blk: number      // Blocks
  tov: number      // Turnovers
  astToRatio: number  // A/T Ratio
}

export interface PlayerValue extends PlayerStats {
  // Draft Metrics
  overallRank: number
  positionRank: number
  suggestedPrice: number  // $1-200
  minPrice: number
  maxPrice: number
  tier: number

  // Category Scores (0-10)
  categoryScores: {
    fgm: number
    fgPct: number
    ftPct: number
    tpm: number
    pts: number
    oreb: number
    reb: number
    ast: number
    stl: number
    blk: number
    astToRatio: number
  }

  vorp: number  // Value Over Replacement Player
  balanceScore: number  // How balanced across categories
}

/**
 * Z-Score 標準化
 * 將統計數據轉換為標準分數
 */
export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0
  return (value - mean) / stdDev
}

/**
 * 計算數組的平均值
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

/**
 * 計算數組的標準差
 */
export function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const avg = mean(values)
  const squaredDiffs = values.map(val => Math.pow(val - avg, 2))
  return Math.sqrt(mean(squaredDiffs))
}

/**
 * 計算 11-Cat 價值
 * 使用 Z-Score 方法標準化各項數據
 */
export function calculatePlayerValues(players: PlayerStats[]): PlayerValue[] {
  // 只保留至少打了 40 場比賽的球員
  const qualifiedPlayers = players.filter(p => p.gamesPlayed >= 40)

  // 計算各項數據的平均值和標準差
  const stats = {
    fgPct: qualifiedPlayers.map(p => p.fgPct),
    ftPct: qualifiedPlayers.map(p => p.ftPct),
    tpm: qualifiedPlayers.map(p => p.tpm),
    pts: qualifiedPlayers.map(p => p.pts),
    oreb: qualifiedPlayers.map(p => p.oreb),
    reb: qualifiedPlayers.map(p => p.reb),
    ast: qualifiedPlayers.map(p => p.ast),
    stl: qualifiedPlayers.map(p => p.stl),
    blk: qualifiedPlayers.map(p => p.blk),
    tov: qualifiedPlayers.map(p => p.tov),
    astToRatio: qualifiedPlayers.map(p => p.astToRatio),
    fgm: qualifiedPlayers.map(p => p.fgm),
  }

  const means = {
    fgPct: mean(stats.fgPct),
    ftPct: mean(stats.ftPct),
    tpm: mean(stats.tpm),
    pts: mean(stats.pts),
    oreb: mean(stats.oreb),
    reb: mean(stats.reb),
    ast: mean(stats.ast),
    stl: mean(stats.stl),
    blk: mean(stats.blk),
    tov: mean(stats.tov),
    astToRatio: mean(stats.astToRatio),
    fgm: mean(stats.fgm),
  }

  const stdDevs = {
    fgPct: stdDev(stats.fgPct),
    ftPct: stdDev(stats.ftPct),
    tpm: stdDev(stats.tpm),
    pts: stdDev(stats.pts),
    oreb: stdDev(stats.oreb),
    reb: stdDev(stats.reb),
    ast: stdDev(stats.ast),
    stl: stdDev(stats.stl),
    blk: stdDev(stats.blk),
    tov: stdDev(stats.tov),
    astToRatio: stdDev(stats.astToRatio),
    fgm: stdDev(stats.fgm),
  }

  // 計算每個球員的 Z-Score 和總價值
  const playerValues: PlayerValue[] = qualifiedPlayers.map(player => {
    const zScores = {
      fgm: calculateZScore(player.fgm, means.fgm, stdDevs.fgm),
      fgPct: calculateZScore(player.fgPct, means.fgPct, stdDevs.fgPct),
      ftPct: calculateZScore(player.ftPct, means.ftPct, stdDevs.ftPct),
      tpm: calculateZScore(player.tpm, means.tpm, stdDevs.tpm),
      pts: calculateZScore(player.pts, means.pts, stdDevs.pts),
      oreb: calculateZScore(player.oreb, means.oreb, stdDevs.oreb),
      reb: calculateZScore(player.reb, means.reb, stdDevs.reb),
      ast: calculateZScore(player.ast, means.ast, stdDevs.ast),
      stl: calculateZScore(player.stl, means.stl, stdDevs.stl),
      blk: calculateZScore(player.blk, means.blk, stdDevs.blk),
      tov: -calculateZScore(player.tov, means.tov, stdDevs.tov), // 失誤越少越好
      astToRatio: calculateZScore(player.astToRatio, means.astToRatio, stdDevs.astToRatio),
    }

    // 總價值 = 所有類別 Z-Score 的總和
    const totalValue = Object.values(zScores).reduce((sum, z) => sum + z, 0)

    // 平衡分數：標準差越小 = 越平衡
    const zScoreValues = Object.values(zScores)
    const balanceScore = 10 - stdDev(zScoreValues)  // 反向計分

    // 類別評分 (0-10 scale)
    const categoryScores = {
      fgm: Math.max(0, Math.min(10, (zScores.fgm + 2) * 2.5)),
      fgPct: Math.max(0, Math.min(10, (zScores.fgPct + 2) * 2.5)),
      ftPct: Math.max(0, Math.min(10, (zScores.ftPct + 2) * 2.5)),
      tpm: Math.max(0, Math.min(10, (zScores.tpm + 2) * 2.5)),
      pts: Math.max(0, Math.min(10, (zScores.pts + 2) * 2.5)),
      oreb: Math.max(0, Math.min(10, (zScores.oreb + 2) * 2.5)),
      reb: Math.max(0, Math.min(10, (zScores.reb + 2) * 2.5)),
      ast: Math.max(0, Math.min(10, (zScores.ast + 2) * 2.5)),
      stl: Math.max(0, Math.min(10, (zScores.stl + 2) * 2.5)),
      blk: Math.max(0, Math.min(10, (zScores.blk + 2) * 2.5)),
      astToRatio: Math.max(0, Math.min(10, (zScores.astToRatio + 2) * 2.5)),
    }

    return {
      ...player,
      overallRank: 0,  // Will be calculated after sorting
      positionRank: 0,
      suggestedPrice: 0,
      minPrice: 0,
      maxPrice: 0,
      tier: 0,
      categoryScores,
      vorp: totalValue,
      balanceScore,
    }
  })

  // 排序並分配排名
  playerValues.sort((a, b) => b.vorp - a.vorp)
  playerValues.forEach((player, index) => {
    player.overallRank = index + 1
  })

  // 計算位置排名
  const positions = ['PG', 'SG', 'SF', 'PF', 'C']
  positions.forEach(pos => {
    const posPlayers = playerValues
      .filter(p => p.position.includes(pos))
      .sort((a, b) => b.vorp - a.vorp)

    posPlayers.forEach((player, index) => {
      player.positionRank = index + 1
    })
  })

  // 計算建議價格（Salary Cap: $200 總預算）
  // 14 隊聯盟，每隊 16 人 = 224 個球員位置
  // 假設前 200 名球員會被選走
  const totalBudget = 200 * 14  // $2800 total league budget
  const topPlayerCount = 200

  playerValues.forEach((player, index) => {
    if (index < topPlayerCount) {
      // 使用對數函數分配價格，讓頂級球員更貴
      const percentile = 1 - (index / topPlayerCount)
      const basePrice = Math.pow(percentile, 1.5) * 100  // Max ~$100

      player.suggestedPrice = Math.max(1, Math.round(basePrice))
      player.minPrice = Math.max(1, Math.round(basePrice * 0.85))
      player.maxPrice = Math.min(200, Math.round(basePrice * 1.15))
    } else {
      player.suggestedPrice = 1
      player.minPrice = 1
      player.maxPrice = 3
    }

    // 分層 (Tier 1-10)
    player.tier = Math.min(10, Math.floor(index / 20) + 1)
  })

  return playerValues
}
