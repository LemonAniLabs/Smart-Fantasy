# Supabase 設定指南

本專案使用 Supabase 作為資料庫來快取球員比賽紀錄，避免重複呼叫 Yahoo Fantasy API。

## 設定步驟

### 1. 建立 Supabase 專案

1. 前往 [Supabase Dashboard](https://supabase.com/dashboard)
2. 點擊 "New Project"
3. 填寫專案資訊：
   - **Name**: fantasy-basketball-ai（或任何你喜歡的名稱）
   - **Database Password**: 設定一個強密碼
   - **Region**: 選擇離你最近的區域
4. 等待專案建立完成（約 2 分鐘）

### 2. 取得 API 憑證

1. 在專案 Dashboard 中，點擊左側選單的 "Project Settings"
2. 點擊 "API" 標籤
3. 複製以下資訊：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...`（一個很長的 JWT token）

### 3. 執行 SQL Schema

1. 在 Supabase Dashboard 中，點擊左側選單的 "SQL Editor"
2. 點擊 "New Query"
3. 複製 `supabase/schema.sql` 的內容並貼上
4. 點擊 "Run" 執行 SQL
5. 確認看到 "Success. No rows returned"

### 4. 設定環境變數

在 `.env` 檔案中加入以下變數：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGc..."
```

將上面的值替換成你從步驟 2 取得的實際值。

### 5. 重啟開發伺服器

```bash
# 停止目前的開發伺服器（Ctrl+C）
# 重新啟動
npm run dev
```

## 資料表結構

### `player_game_logs`

儲存球員的逐場比賽數據。

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | UUID | 主鍵 |
| `player_key` | TEXT | Yahoo 球員 key（例如：428.p.6583） |
| `player_name` | TEXT | 球員名稱 |
| `game_date` | DATE | 比賽日期 |
| `stats` | JSONB | 比賽統計數據（JSON 格式） |
| `created_at` | TIMESTAMP | 建立時間 |
| `updated_at` | TIMESTAMP | 更新時間 |

**唯一約束**: 每個球員每個日期只能有一筆記錄（`player_key`, `game_date`）

## Cache 機制

1. **首次查詢**: 當使用者查詢球員的比賽紀錄時，API 會先檢查 Supabase
2. **Cache Hit**: 如果資料庫中已有該球員該日期的紀錄，直接從資料庫返回
3. **Cache Miss**: 如果沒有紀錄，則呼叫 Yahoo API 獲取，並儲存到資料庫
4. **自動更新**: `updated_at` 欄位會在每次更新時自動更新

## 監控與維護

### 查看資料庫內容

在 Supabase Dashboard 的 "Table Editor" 中可以查看 `player_game_logs` 表的內容。

### 清除快取

如果需要清除所有快取資料：

```sql
TRUNCATE TABLE player_game_logs;
```

### 查看特定球員的快取

```sql
SELECT * FROM player_game_logs
WHERE player_key = '428.p.6583'
ORDER BY game_date DESC;
```

## 效能優化

- 資料表已建立多個索引來加速查詢
- 使用 JSONB 格式儲存統計數據，支援高效的 JSON 查詢
- 自動更新時間戳記，方便追蹤資料新鮮度

## 疑難排解

### 錯誤：Missing Supabase environment variables

確認 `.env` 檔案中有正確設定 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。

### 錯誤：relation "player_game_logs" does not exist

需要執行 `supabase/schema.sql` 來建立資料表。

### API 仍然很慢

初次查詢時仍需要呼叫 Yahoo API，所以會較慢。之後的查詢會使用快取，速度會大幅提升。
