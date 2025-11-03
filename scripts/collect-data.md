# 資料收集步驟指南

## 前置準備

1. **在瀏覽器中登入**
   - 開啟 http://localhost:3000
   - 點擊「Sign in with Yahoo」
   - 完成 Yahoo 登入

2. **取得你的聯盟資訊**
   - 登入後，瀏覽器會自動獲取你的 session
   - 所有後續的 API 調用都會使用這個 session

---

## 方法 1: 使用瀏覽器開發者工具

這是最簡單的方法，因為瀏覽器已經有你的 session。

### Step 1: 取得聯盟 Key

在瀏覽器開發者工具的 Console 中執行：

```javascript
// 1. 取得聯盟列表
fetch('/api/yahoo/leagues')
  .then(r => r.json())
  .then(data => {
    console.log('你的聯盟:', data);
    // 記下你的 league_key，例如: nba.l.12345
  });
```

### Step 2: 取得聯盟球員列表

```javascript
// 替換成你的 league_key
const leagueKey = 'nba.l.12345';

fetch(`/api/yahoo/league-players?leagueKey=${leagueKey}`)
  .then(r => r.json())
  .then(data => {
    console.log('聯盟球員:', data);
    // 你會看到所有球員的 player_key
  });
```

### Step 3: 回填上一個賽季 (2024-25)

**重要**: 先建立上一個賽季的歷史資料

```javascript
// 選擇一個球員進行測試（例如 LeBron James: nba.p.3704）
const playerKey = 'nba.p.3704';

// 開始回填 2024-25 賽季
async function backfillSeason(playerKey, season) {
  let status = 'partial';
  let totalGames = 0;

  while (status === 'partial') {
    const response = await fetch(
      `/api/yahoo/backfill-player-season?playerKey=${playerKey}&season=${season}&batchSize=50`
    );
    const data = await response.json();

    status = data.status;
    totalGames += data.results.newGames;

    console.log(`${data.playerName}: ${data.progress.percentComplete}% 完成`);
    console.log(`新增 ${data.results.newGames} 場比賽，總計 ${totalGames} 場`);

    // 避免 rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`✅ ${season} 賽季回填完成！總共 ${totalGames} 場比賽`);
  return totalGames;
}

// 執行回填
backfillSeason(playerKey, '2024-25')
  .then(total => console.log('完成！總共:', total));
```

### Step 4: 同步當前賽季 (2025-26)

```javascript
// 同步當前賽季（只拉取缺失的資料）
fetch(`/api/yahoo/sync-player-games?playerKey=${playerKey}`)
  .then(r => r.json())
  .then(data => {
    console.log(`同步完成:`, data);
    console.log(`現有比賽: ${data.existingGames}`);
    console.log(`新增比賽: ${data.newGames}`);
    console.log(`API 調用: ${data.apiCallsMade}`);
  });
```

### Step 5: 批次收集整個聯盟

```javascript
// 一次同步整個聯盟的所有球員
async function syncEntireLeague(leagueKey) {
  let status = 'partial';
  let totalPlayers = 0;
  let totalGames = 0;

  while (status === 'partial') {
    const response = await fetch(
      `/api/yahoo/batch-sync-league?leagueKey=${leagueKey}&batchSize=10&daysToCheck=30`
    );
    const data = await response.json();

    status = data.status;
    totalPlayers += data.summary.syncedPlayers;
    totalGames += data.summary.gamesAdded;

    console.log(`已同步 ${totalPlayers}/${data.summary.totalPlayers} 個球員`);
    console.log(`新增 ${data.summary.gamesAdded} 場比賽`);

    // 避免 rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`✅ 聯盟同步完成！`);
  console.log(`總球員: ${totalPlayers}`);
  console.log(`總比賽: ${totalGames}`);
}

// 執行批次同步
syncEntireLeague(leagueKey);
```

---

## 方法 2: 使用 Node.js 腳本

創建一個檔案 `collect-league-data.js`:

```javascript
// collect-league-data.js
// 注意: 你需要從瀏覽器中複製 session cookie

const LEAGUE_KEY = 'nba.l.12345'; // 替換成你的聯盟 key
const BASE_URL = 'http://localhost:3000';

// 步驟 1: 從瀏覽器取得 session cookie
// 1. 在瀏覽器登入後
// 2. 開啟開發者工具 > Application > Cookies
// 3. 複製 next-auth.session-token 的值
const SESSION_COOKIE = 'your-session-token-here';

async function collectData() {
  // 實作批次收集邏輯
  console.log('開始收集資料...');

  // 這個方法需要處理 cookie，比較複雜
  // 建議使用方法 1（瀏覽器開發者工具）
}
```

---

## 建議的收集順序

### 階段 1: 測試單一球員

```javascript
// 1. 先用一個球員測試整個流程
const testPlayer = 'nba.p.3704'; // LeBron James

// 2. 回填 2024-25 賽季
await backfillSeason(testPlayer, '2024-25');

// 3. 同步 2025-26 賽季
await fetch(`/api/yahoo/sync-player-games?playerKey=${testPlayer}`).then(r => r.json());

// 4. 檢查資料庫
// 在 Supabase Dashboard 中查看 player_game_logs 表
```

### 階段 2: 收集整個聯盟

```javascript
// 1. 批次回填所有球員的 2024-25 賽季
// （這會需要比較長的時間，建議分批進行）

// 2. 批次同步所有球員的 2025-26 賽季
await syncEntireLeague(leagueKey);
```

### 階段 3: 設定每日自動同步

```javascript
// 每天執行一次，只需檢查最近 7 天
fetch(`/api/yahoo/batch-sync-league?leagueKey=${leagueKey}&batchSize=20&daysToCheck=7`)
  .then(r => r.json())
  .then(data => console.log('每日同步完成:', data));
```

---

## 監控資料收集進度

### 檢查資料庫

在 Supabase Dashboard 中執行：

```sql
-- 查看每個球員的比賽數量
SELECT
  player_name,
  COUNT(*) as games_count,
  MIN(game_date) as first_game,
  MAX(game_date) as last_game
FROM player_game_logs
GROUP BY player_key, player_name
ORDER BY games_count DESC
LIMIT 20;

-- 查看最近收集的資料
SELECT
  player_name,
  game_date,
  stats->>'5' as pts,
  stats->>'6' as reb,
  stats->>'7' as ast,
  minutes_played
FROM player_game_logs
ORDER BY created_at DESC
LIMIT 50;

-- 查看每日比賽數量
SELECT
  game_date,
  COUNT(DISTINCT player_key) as players_count,
  SUM((stats->>'5')::float) as total_points
FROM player_game_logs
WHERE game_date >= '2025-10-21'
GROUP BY game_date
ORDER BY game_date DESC;
```

---

## 常見問題

### Q: 如何知道收集是否完整？

A: 執行這個查詢：

```sql
SELECT
  game_date,
  COUNT(*) as games
FROM player_game_logs
WHERE game_date >= '2025-10-21'
GROUP BY game_date
ORDER BY game_date DESC;
```

如果某天的比賽數量明顯少於其他天，可能有資料缺失。

### Q: 如果中途中斷了怎麼辦？

A: 所有 API 都支援斷點續傳：
- `backfill-player-season` 會自動跳過已存在的日期
- `sync-player-games` 只拉取缺失的日期
- `batch-sync-league` 可以重新調用，會繼續處理剩餘的球員

### Q: 大約需要多長時間？

A: 估算：
- 單一球員 2024-25 賽季: 1-2 分鐘
- 單一球員 2025-26 賽季: 10-30 秒
- 整個聯盟 (200 球員): 10-20 分鐘

---

## 下一步

資料收集完成後，你可以：

1. **查看統計數據** - 在 Supabase 中分析球員表現
2. **實作分析引擎** - 熱門球員偵測、價值分析
3. **建立 UI** - 顯示球員趨勢圖表
4. **設定自動化** - 每日自動同步新資料

開始收集吧！ 🚀
