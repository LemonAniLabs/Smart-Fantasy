# 未來自動化同步策略

## 概述

初始資料建制完成後，產品環境會使用智能的增量同步機制：

1. **精準同步** - 只更新有比賽的球員
2. **提前規劃** - 根據賽程預知需要更新的球員
3. **定時掃描** - 監控受傷狀態和其他重要資訊
4. **高效能** - 最小化 API 調用次數

---

## 核心策略

### 策略 1: 基於賽程的精準同步

傳統方法的問題：
- ❌ 每天同步所有 200+ 球員
- ❌ 大量無效 API 調用（沒比賽的球員）
- ❌ 浪費資源和時間

**改進方案：提前獲取賽程**

```typescript
// 1. 每天從 NBA API 獲取當日賽程
const todaysGames = await getNBASchedule(today);

// 例如: 今天只有 8 場比賽
// LAL vs GSW, BOS vs MIA, ...

// 2. 從賽程中提取球隊
const teams = extractTeams(todaysGames);
// ['LAL', 'GSW', 'BOS', 'MIA', ...]

// 3. 找出這些球隊的球員
const playersToUpdate = await getPlayersFromTeams(teams);
// 約 16 隊 x 13 球員 = ~200 個球員

// 4. 只同步這些球員
await batchSyncPlayers(playersToUpdate);
```

**優勢**:
- ✅ API 調用減少 70-80%
- ✅ 更新更及時（知道哪些比賽已結束）
- ✅ 可以處理不同比賽時間

---

## 實作計畫

### Phase 1: NBA 賽程 API 整合

#### 使用 NBA Stats API

```typescript
// lib/nba/schedule.ts

export async function getNBAScheduleForDate(date: string): Promise<Game[]> {
  const url = `https://stats.nba.com/stats/scoreboardv2?GameDate=${date}&LeagueID=00&DayOffset=0`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://stats.nba.com/',
    }
  });

  const data = await response.json();

  // 解析賽程
  const games = data.resultSets[0].rowSet.map((game: any) => ({
    gameId: game[2],
    gameDate: game[0],
    homeTeam: game[6],
    awayTeam: game[7],
    gameStatus: game[4], // 1=未開始, 2=進行中, 3=已結束
    homeScore: game[21],
    awayScore: game[22]
  }));

  return games;
}

export async function getGamesForNext7Days(): Promise<Game[]> {
  const games = [];
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const dailyGames = await getNBAScheduleForDate(dateStr);
    games.push(...dailyGames);
  }

  return games;
}
```

#### 球隊 Roster 管理

```typescript
// lib/nba/teams.ts

// 快取球隊 roster（每週更新一次）
const TEAM_ROSTERS: Record<string, string[]> = {
  'LAL': ['nba.p.3704', 'nba.p.5007', ...], // LeBron, AD, ...
  'GSW': ['nba.p.4612', 'nba.p.5826', ...], // Curry, Klay, ...
  // ...
};

export function getPlayersFromTeams(teams: string[]): string[] {
  const players = new Set<string>();

  teams.forEach(team => {
    const roster = TEAM_ROSTERS[team] || [];
    roster.forEach(p => players.add(p));
  });

  return Array.from(players);
}

export async function updateTeamRosters(): Promise<void> {
  // 從 Yahoo API 或 NBA API 更新所有球隊的 roster
  // 每週執行一次（處理交易、簽約）
}
```

---

### Phase 2: 智能同步排程

#### Cron Job 設定

```typescript
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/sync-daily-games",
      "schedule": "0 12 * * *"  // UTC+8 中午 12:00（多數比賽已結束）
    },
    {
      "path": "/api/cron/sync-late-games",
      "schedule": "0 2 * * *"   // UTC+8 凌晨 2:00（西岸比賽結束）
    },
    {
      "path": "/api/cron/injury-check",
      "schedule": "0 * * * *"   // 每小時
    },
    {
      "path": "/api/cron/update-team-rosters",
      "schedule": "0 0 * * 1"   // 每週一午夜
    }
  ]
}
```

#### 每日同步 API

```typescript
// app/api/cron/sync-daily-games/route.ts

export async function GET() {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  console.log(`=== Daily Sync: ${today} ===`);

  try {
    // 1. 獲取昨天和今天的賽程
    const yesterdayGames = await getNBAScheduleForDate(yesterday);
    const todayGames = await getNBAScheduleForDate(today);

    // 2. 提取已結束的比賽
    const completedGames = [...yesterdayGames, ...todayGames].filter(
      g => g.gameStatus === 3 // 已結束
    );

    console.log(`Found ${completedGames.length} completed games`);

    // 3. 找出參賽球隊
    const teams = new Set<string>();
    completedGames.forEach(game => {
      teams.add(game.homeTeam);
      teams.add(game.awayTeam);
    });

    console.log(`Teams with games: ${Array.from(teams).join(', ')}`);

    // 4. 找出這些球隊的球員
    const playersToUpdate = getPlayersFromTeams(Array.from(teams));

    console.log(`Players to update: ${playersToUpdate.length}`);

    // 5. 批次同步這些球員（使用現有的 sync API）
    const results = [];

    for (const playerKey of playersToUpdate) {
      const result = await syncPlayerRecentGames(playerKey, 3); // 最近 3 天
      results.push(result);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 6. 統計結果
    const summary = {
      date: today,
      completedGames: completedGames.length,
      teamsUpdated: teams.size,
      playersUpdated: playersToUpdate.length,
      gamesAdded: results.reduce((sum, r) => sum + r.newGames, 0),
      apiCalls: results.reduce((sum, r) => sum + r.apiCalls, 0),
      duration: Date.now() - startTime
    };

    console.log('Summary:', summary);

    return Response.json({
      success: true,
      summary
    });

  } catch (error) {
    console.error('Daily sync failed:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Helper function
async function syncPlayerRecentGames(playerKey: string, days: number) {
  // 調用現有的 sync-player-games API
  // 只檢查最近幾天
}
```

---

### Phase 3: 受傷狀態監控

#### 受傷報告 API

```typescript
// app/api/cron/injury-check/route.ts

export async function GET() {
  console.log('=== Injury Status Check ===');

  try {
    // 1. 從 NBA API 獲取受傷報告
    const injuries = await getNBAInjuryReport();

    console.log(`Found ${injuries.length} injury updates`);

    // 2. 儲存到 player_analytics 表
    for (const injury of injuries) {
      await supabase
        .from('player_analytics')
        .upsert({
          player_key: injury.playerKey,
          player_name: injury.playerName,
          analysis_date: new Date().toISOString().split('T')[0],
          // 在 JSONB 欄位中儲存受傷資訊
          trend_reasons: [
            `injury_status: ${injury.status}`,
            `injury_type: ${injury.type || 'unknown'}`,
            `return_date: ${injury.returnDate || 'TBD'}`
          ]
        });
    }

    return Response.json({
      success: true,
      injuriesFound: injuries.length
    });

  } catch (error) {
    console.error('Injury check failed:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Helper function
async function getNBAInjuryReport() {
  const url = 'https://stats.nba.com/stats/internationalbroadcasterschedule';

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://stats.nba.com/',
    }
  });

  const data = await response.json();

  // 解析受傷報告
  // 格式會依 NBA API 而定
  return parseInjuryData(data);
}
```

---

### Phase 4: 預測性同步

#### 提前規劃（前一天晚上）

```typescript
// app/api/cron/plan-tomorrow/route.ts

export async function GET() {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  console.log(`=== Planning for ${tomorrow} ===`);

  // 1. 獲取明天的賽程
  const tomorrowGames = await getNBAScheduleForDate(tomorrow);

  console.log(`Tomorrow has ${tomorrowGames.length} games`);

  // 2. 提取球隊和球員
  const teams = new Set<string>();
  tomorrowGames.forEach(game => {
    teams.add(game.homeTeam);
    teams.add(game.awayTeam);
  });

  const playersInGames = getPlayersFromTeams(Array.from(teams));

  // 3. 儲存到 cache（供明天使用）
  await supabase
    .from('analytics_cache')
    .upsert({
      cache_key: `planned_sync_${tomorrow}`,
      cache_type: 'matchup_preview',
      data: {
        games: tomorrowGames,
        teams: Array.from(teams),
        players: playersInGames
      },
      expires_at: new Date(Date.now() + 86400000 * 2).toISOString() // 2 天後過期
    });

  console.log(`Planned ${playersInGames.length} players for tomorrow`);

  return Response.json({
    success: true,
    tomorrow,
    games: tomorrowGames.length,
    players: playersInGames.length
  });
}
```

**Cron 設定**:
```json
{
  "path": "/api/cron/plan-tomorrow",
  "schedule": "0 20 * * *"  // UTC+8 晚上 8:00（規劃明天）
}
```

---

## 完整同步時間表

| 時間 (UTC+8) | 任務 | 目的 |
|-------------|------|------|
| 08:00 | Early sync | 同步東岸比賽（美東晚上比賽） |
| 12:00 | **Main sync** | 同步大部分比賽 |
| 16:00 | Afternoon check | 同步下午比賽 |
| 02:00 | Late sync | 同步西岸深夜比賽 |
| 20:00 | Plan tomorrow | 規劃明天需要更新的球員 |
| 每小時 | Injury check | 受傷狀態掃描 |
| 每週一 00:00 | Roster update | 更新球隊名單（交易） |

---

## 效能估算

### 傳統方法（全量同步）
- 200 球員 x 每天
- 200 API calls/day
- 全年約 73,000 次調用

### 智能同步（基於賽程）
- 平均每天 8 場比賽
- 16 隊 x 13 球員 = ~200 球員
- 但只有比賽日才需要更新
- 全年約 82 天 x 200 = 16,400 次調用

**節省**: ~78% API 調用

---

## 監控與警報

### Metrics 追蹤

```typescript
// 每次同步後記錄 metrics
await supabase
  .from('sync_metrics')
  .insert({
    sync_type: 'daily',
    date: today,
    players_updated: 200,
    games_added: 150,
    api_calls: 200,
    duration_ms: 45000,
    errors: 2
  });
```

### 警報條件

```typescript
// 檢查異常情況
if (summary.gamesAdded < 100 && completedGames.length > 5) {
  // 應該有更多比賽，可能有問題
  await sendAlert({
    type: 'low_games',
    expected: completedGames.length * 10,
    actual: summary.gamesAdded
  });
}

if (summary.errors > 10) {
  // 錯誤過多
  await sendAlert({
    type: 'high_errors',
    count: summary.errors
  });
}
```

---

## 總結

完成初始資料建制後，產品環境將使用：

1. ✅ **智能同步** - 基於賽程，只更新有比賽的球員
2. ✅ **預測性規劃** - 提前知道明天需要更新誰
3. ✅ **多時段同步** - 配合不同比賽時間
4. ✅ **受傷監控** - 每小時掃描
5. ✅ **Roster 管理** - 每週更新球隊名單

這將大幅減少 API 調用次數，提高系統效率和可靠性。
