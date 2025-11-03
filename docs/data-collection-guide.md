# 資料收集系統使用指南

## 概述

本系統提供完整的球員數據收集與同步機制，支援：
- ✅ 增量同步（只拉取新資料）
- ✅ 歷史資料回填
- ✅ 批次處理（避免超時）
- ✅ 自動去重（Supabase unique constraint）
- ✅ 效能優化（cache 機制）

---

## 資料收集策略

### 建議的執行順序

1. **先建立歷史資料** - 回填上一個賽季 (2023-24)
2. **同步當前賽季** - 回填本賽季 (2024-25)
3. **定期增量同步** - 每日自動同步新資料

---

## API Endpoints

### 1. 歷史資料回填 API

**用途**: 回填整個賽季的歷史資料

**Endpoint**: `/api/yahoo/backfill-player-season`

**參數**:
- `playerKey` (必填): 球員 key (例如: `nba.p.6583`)
- `season` (選填): 賽季 (預設: `2024-25`)
  - 可用選項: `2024-25`, `2023-24`, `2022-23`
- `batchSize` (選填): 每次處理的日期數量 (預設: `50`)

**回應**:
```json
{
  "playerKey": "nba.p.6583",
  "playerName": "LeBron James",
  "season": "2023-24",
  "status": "partial" | "complete",
  "message": "Batch complete. 200 dates remaining. Call again to continue.",
  "progress": {
    "totalDates": 250,
    "processedDates": 50,
    "remainingDates": 200,
    "percentComplete": 20
  },
  "results": {
    "existingGames": 10,
    "newGames": 35,
    "apiCallsMade": 50,
    "errors": 0
  },
  "nextBatch": {
    "url": "/api/yahoo/backfill-player-season?playerKey=nba.p.6583&season=2023-24&batchSize=50",
    "remainingDates": 200
  }
}
```

**使用範例**:

```bash
# 回填 2023-24 賽季資料
curl "http://localhost:3000/api/yahoo/backfill-player-season?playerKey=nba.p.6583&season=2023-24&batchSize=50"

# 繼續下一批次（直到 status = 'complete'）
curl "http://localhost:3000/api/yahoo/backfill-player-season?playerKey=nba.p.6583&season=2023-24&batchSize=50"
```

**注意事項**:
- 每次調用處理 `batchSize` 個日期（避免超時）
- `status = "partial"` 表示還有資料需要繼續回填
- 重複調用直到 `status = "complete"`
- 自動跳過已存在的資料（去重）

---

### 2. 增量同步 API

**用途**: 只拉取資料庫中缺失的日期

**Endpoint**: `/api/yahoo/sync-player-games`

**參數**:
- `playerKey` (必填): 球員 key
- `startDate` (選填): 起始日期 (預設: 賽季開始)
- `endDate` (選填): 結束日期 (預設: 今天)

**回應**:
```json
{
  "playerKey": "nba.p.6583",
  "playerName": "LeBron James",
  "status": "success" | "up_to_date",
  "dateRange": {
    "start": "2024-10-22",
    "end": "2025-01-15"
  },
  "existingGames": 45,
  "newGames": 3,
  "apiCallsMade": 10,
  "totalDatesChecked": 10
}
```

**使用範例**:

```bash
# 同步整個賽季（只拉取缺失的日期）
curl "http://localhost:3000/api/yahoo/sync-player-games?playerKey=nba.p.6583"

# 同步特定日期範圍
curl "http://localhost:3000/api/yahoo/sync-player-games?playerKey=nba.p.6583&startDate=2025-01-01&endDate=2025-01-15"
```

**優點**:
- 自動檢測缺失的日期
- 只調用必要的 API
- 適合每日定期同步

---

### 3. 批次同步整個聯盟

**用途**: 一次同步整個聯盟的所有球員

**Endpoint**: `/api/yahoo/batch-sync-league`

**參數**:
- `leagueKey` (必填): 聯盟 key
- `batchSize` (選填): 每次處理的球員數量 (預設: `10`)
- `daysToCheck` (選填): 檢查最近幾天 (預設: `30`)

**回應**:
```json
{
  "leagueKey": "nba.l.12345",
  "status": "partial" | "complete",
  "message": "Batch complete. 150 players remaining.",
  "summary": {
    "totalPlayers": 200,
    "syncedPlayers": 10,
    "remainingPlayers": 190,
    "gamesAdded": 45,
    "apiCallsMade": 250,
    "durationMs": 45000
  },
  "results": [
    {
      "playerKey": "nba.p.6583",
      "playerName": "LeBron James",
      "status": "success",
      "gamesAdded": 3,
      "apiCalls": 10
    }
  ],
  "nextBatch": {
    "url": "/api/yahoo/batch-sync-league?leagueKey=nba.l.12345&batchSize=10&daysToCheck=30",
    "remainingPlayers": 190
  }
}
```

**使用範例**:

```bash
# 批次同步聯盟（每次10個球員）
curl "http://localhost:3000/api/yahoo/batch-sync-league?leagueKey=nba.l.12345&batchSize=10&daysToCheck=30"

# 繼續下一批次
curl "http://localhost:3000/api/yahoo/batch-sync-league?leagueKey=nba.l.12345&batchSize=10&daysToCheck=30"
```

**適用場景**:
- 每日定期同步
- 自動化 cron job
- 確保所有球員數據都是最新的

---

## 實作流程

### Step 1: 回填上一個賽季 (2023-24)

```bash
# 1. 首先取得你的聯盟球員列表
curl "http://localhost:3000/api/yahoo/league-players?leagueKey=nba.l.12345"

# 2. 對每個球員進行歷史回填
curl "http://localhost:3000/api/yahoo/backfill-player-season?playerKey=nba.p.6583&season=2023-24&batchSize=50"

# 3. 重複調用直到 status = "complete"
# ... 繼續其他球員
```

**或使用批次腳本**:

```javascript
// backfill-season.js
const players = ['nba.p.6583', 'nba.p.6588', ...]; // 你的球員列表

for (const playerKey of players) {
  let status = 'partial';

  while (status !== 'complete') {
    const response = await fetch(
      `/api/yahoo/backfill-player-season?playerKey=${playerKey}&season=2023-24&batchSize=50`
    );
    const data = await response.json();
    status = data.status;

    console.log(`${playerKey}: ${data.progress.percentComplete}%`);

    // 避免 rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`✓ ${playerKey} complete!`);
}
```

### Step 2: 同步當前賽季 (2024-25)

```bash
# 使用增量同步（自動跳過已存在的資料）
curl "http://localhost:3000/api/yahoo/sync-player-games?playerKey=nba.p.6583"
```

### Step 3: 設定每日自動同步

使用批次同步 API + Cron job:

```bash
# vercel.json
{
  "crons": [
    {
      "path": "/api/cron/daily-sync",
      "schedule": "0 9 * * *"
    }
  ]
}
```

```typescript
// app/api/cron/daily-sync/route.ts
export async function GET() {
  const leagueKey = process.env.LEAGUE_KEY;

  // 批次同步整個聯盟（最近 7 天）
  const response = await fetch(
    `/api/yahoo/batch-sync-league?leagueKey=${leagueKey}&batchSize=20&daysToCheck=7`
  );

  return response;
}
```

---

## 資料結構

### player_game_logs 表

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | UUID | 主鍵 |
| `player_key` | TEXT | 球員 key |
| `player_name` | TEXT | 球員姓名 |
| `game_date` | DATE | 比賽日期 |
| `stats` | JSONB | 統計數據 (stat_id: value) |
| `opponent` | TEXT | 對手（未來實作） |
| `home_away` | TEXT | 主客場（未來實作） |
| `minutes_played` | INTEGER | 上場時間 (stat_id=3) |
| `game_result` | TEXT | 比賽結果（未來實作） |
| `created_at` | TIMESTAMP | 建立時間 |
| `updated_at` | TIMESTAMP | 更新時間 |

**Unique Constraint**: `(player_key, game_date)` - 自動去重

---

## 效能與限制

### Yahoo API Rate Limits
- 建議每個請求間隔 150-200ms
- 每小時約 18,000 次請求限制
- 使用批次處理避免超時

### Vercel Limits
- 免費版: 10 秒 function timeout
- Pro: 60 秒 timeout
- 建議 `batchSize` 設定:
  - 免費版: 10-20
  - Pro: 50-100

### 估算時間

**回填整個賽季** (約 250 天):
- batchSize = 50
- 每批次約 10-15 秒
- 總批次數 = 250 / 50 = 5
- **總時間: 約 1-2 分鐘**

**批次同步 200 個球員**:
- batchSize = 10
- daysToCheck = 7
- 每批次約 30-40 秒
- 總批次數 = 200 / 10 = 20
- **總時間: 約 10-15 分鐘**

---

## 錯誤處理

所有 API 都包含錯誤處理：
- 自動重試機制
- 錯誤統計
- 詳細日誌輸出

**常見錯誤**:
- `401 Unauthorized` - Yahoo token 過期，需重新登入
- `503 Service Unavailable` - Supabase 未配置
- `429 Too Many Requests` - Rate limit，降低請求頻率

---

## 監控與維護

### 檢查資料完整性

```sql
-- 查看每個球員的比賽數量
SELECT
  player_name,
  COUNT(*) as games_count,
  MIN(game_date) as first_game,
  MAX(game_date) as last_game
FROM player_game_logs
GROUP BY player_key, player_name
ORDER BY games_count DESC;

-- 查看資料缺口
SELECT
  game_date,
  COUNT(DISTINCT player_key) as players_count
FROM player_game_logs
WHERE game_date >= '2024-10-22'
GROUP BY game_date
ORDER BY game_date DESC;
```

### 清理重複資料

```sql
-- 資料庫的 unique constraint 會自動防止重複
-- 但如果需要手動清理：
DELETE FROM player_game_logs a
USING player_game_logs b
WHERE a.id < b.id
  AND a.player_key = b.player_key
  AND a.game_date = b.game_date;
```

---

## 總結

這套資料收集系統提供：

✅ **完整性** - 覆蓋整個賽季的所有比賽
✅ **高效率** - 增量同步，避免重複拉取
✅ **可靠性** - 自動去重，錯誤處理
✅ **靈活性** - 批次處理，可中斷續傳
✅ **自動化** - 支援 cron job 定期執行

**下一步**: 基於這些資料實作分析引擎（熱門球員偵測、價值分析等）
