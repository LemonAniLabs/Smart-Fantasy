# Yahoo Fantasy API 完整功能清單

根據 yfpy (Yahoo Fantasy Python) 和其他官方 API wrapper 的研究，這份文檔列出 Yahoo Fantasy API 實際能夠獲取的所有資訊。

## 📊 Player Stats 查詢方式

Yahoo Fantasy API 支援多種時間範圍的統計查詢：

### 可用的 Type 參數

| Type | 說明 | 適用運動 | 範例 URL |
|------|------|----------|---------|
| `type=season` | 整季統計 | 全部 | `/player/{key}/stats;type=season` |
| `type=date;date=YYYY-MM-DD` | 特定日期統計 | NBA, MLB, NHL | `/player/{key}/stats;type=date;date=2024-10-29` |
| `type=week;week=N` | 特定週統計 | NFL (僅美式足球) | `/player/{key}/stats;type=week;week=1` |
| `type=lastweek` | 上週統計 | 全部 | `/player/{key}/stats;type=lastweek` |
| `type=lastmonth` | 上個月統計 | 全部 | `/player/{key}/stats;type=lastmonth` |
| `type=average_season` | 賽季平均 | 全部 | `/player/{key}/stats;type=average_season` |

### 重要發現

✅ **我們目前的做法是正確的！**
- NBA 使用 `type=date;date=YYYY-MM-DD` 來查詢特定日期
- `type=week` 只適用於 NFL
- 我們目前用 date-by-date 的方式來建立 game logs 是最佳做法

---

## 🎮 Game Resource

### 可用方法
- `get_all_yahoo_fantasy_game_keys()` - 取得所有 game keys
- `get_game_key_by_season(season)` - 取得特定賽季的 game key
- `get_current_game_info()` - 取得當前賽季完整資訊
- `get_current_game_metadata()` - 取得當前賽季 metadata
- `get_game_info_by_game_id(game_id)` - 取得特定 game 資訊
- `get_game_weeks_by_game_id(game_id)` - 取得所有有效週數
- `get_game_stat_categories_by_game_id(game_id)` - **取得所有統計類別**
- `get_game_position_types_by_game_id(game_id)` - 取得所有位置類型
- `get_game_roster_positions_by_game_id(game_id)` - 取得所有 roster 位置

### 可獲取資料
- Game ID 和 key
- 賽季資訊
- 統計類別定義（stat categories）
- 位置資訊
- 週數資訊

---

## 👤 User Resource

### 可用方法
- `get_current_user()` - 取得當前使用者 metadata
- `get_user_games()` - 取得使用者的 game 歷史
- `get_user_leagues_by_game_key(game_key)` - 取得特定 game 的聯盟歷史
- `get_user_teams()` - 取得使用者所有球隊

### 可獲取資料
- 使用者 GUID
- 使用者名稱
- 參與的聯盟列表
- 擁有的球隊列表

---

## 🏆 League Resource

### 可用方法
- `get_league_key(season)` - 產生聯盟 key
- `get_league_info()` - 取得完整聯盟資訊
- `get_league_metadata()` - 取得聯盟 metadata
- `get_league_settings()` - **取得聯盟規則和設定**
- `get_league_standings()` - 取得聯盟排名
- `get_league_teams()` - 取得聯盟所有球隊
- `get_league_players(player_count_limit, player_count_start)` - 取得聯盟球員
- `get_league_draft_results()` - **取得選秀結果**
- `get_league_transactions()` - **取得交易記錄**
- `get_league_scoreboard_by_week(week)` - **取得每週記分板**
- `get_league_matchups_by_week(week)` - **取得每週對戰**

### 可獲取資料
- 聯盟設定（計分規則、roster 限制等）
- 球隊排名和戰績
- 選秀歷史
- 交易歷史
- 每週對戰結果
- 可用球員列表

---

## 👥 Team Resource

### 可用方法
- `get_team_info(team_id)` - 取得球隊完整資訊
- `get_team_metadata(team_id)` - 取得球隊 metadata
- `get_team_stats(team_id)` - **取得球隊整季統計**
- `get_team_stats_by_week(team_id, week)` - **取得球隊每週統計**
- `get_team_standings(team_id)` - 取得球隊排名
- `get_team_roster_by_week(team_id, week)` - **取得特定週的 roster**
- `get_team_roster_player_info_by_week(team_id, week)` - **取得 roster 球員詳細資訊**
- `get_team_roster_player_stats(team_id)` - **取得 roster 球員統計**
- `get_team_roster_player_stats_by_week(team_id, week)` - **取得每週 roster 統計**
- `get_team_draft_results(team_id)` - 取得球隊選秀結果
- `get_team_matchups(team_id)` - **取得球隊所有對戰**

### 可獲取資料
- 球隊名稱、logo、經理資訊
- 球隊整季和每週統計
- Roster 組成（每週不同）
- 對戰歷史和結果
- 選秀結果

---

## 🏀 Player Resource

### 可用方法
- `get_player_stats_for_season(player_key, limit_to_league_stats)` - **取得球員整季統計**
- `get_player_stats_by_week(player_key, week, limit_to_league_stats)` - **取得球員每週統計**
- `get_player_stats_by_date(player_key, date)` - **取得球員特定日期統計**
- `get_player_ownership(player_key)` - 取得球員所有權資訊
- `get_player_percent_owned_by_week(player_key, week)` - 取得每週擁有率
- `get_player_draft_analysis(player_key)` - **取得選秀分析**

### 可獲取資料
- **完整的統計數據**（依 stat_id 區分）
- **逐日/逐週的表現記錄**
- 球員基本資訊（姓名、位置、球隊）
- 擁有率百分比
- 選秀順位和 ADP
- 傷病狀態

---

## 📈 Transaction Resource

### 可用方法
- `get_league_transactions()` - 取得聯盟所有交易
- `get_league_transactions_by_type(transaction_types)` - **依類型篩選交易**

### Transaction 類型
- `add` - 加入球員
- `drop` - 釋出球員
- `commish` - 專員操作
- `trade` - 交易

### 可獲取資料
- 交易時間戳
- 交易類型
- 涉及的球員
- 涉及的球隊
- 交易狀態（pending, successful, failed）

---

## 🎯 Matchup Resource

### 可用方法
- `get_league_matchups_by_week(week)` - 取得特定週所有對戰
- `get_team_matchups(team_id)` - 取得球隊所有對戰

### 可獲取資料
- 對戰雙方
- 比分
- 勝負結果
- 統計類別得分明細
- 週數

---

## 🏅 Draft Resource

### 可用方法
- `get_league_draft_results()` - 取得完整選秀結果
- `get_team_draft_results(team_id)` - 取得球隊選秀結果

### 可獲取資料
- 選秀順位
- 被選中的球員
- 選秀時間
- 選秀球隊

---

## 💡 我們目前沒有用到但可以實作的功能

### 1. **Weekly Stats (上週/上月統計)**
```typescript
// 使用 type=lastweek 或 type=lastmonth
GET /player/{player_key}/stats;type=lastweek
GET /player/{player_key}/stats;type=lastmonth
```

**用途：**
- 查看球員最近表現
- 熱門/冷門球員分析

### 2. **League Transactions (交易記錄)**
```typescript
GET /league/{league_key}/transactions
```

**用途：**
- 追蹤聯盟活動
- 分析哪些球員最搶手
- Waiver wire 趨勢

### 3. **Player Ownership & Percent Owned**
```typescript
GET /player/{player_key}/ownership
GET /player/{player_key}/percent_owned;week={week}
```

**用途：**
- 找出被低估的球員
- 擁有率變化趨勢

### 4. **Draft Analysis**
```typescript
GET /player/{player_key}/draft_analysis
```

**用途：**
- 查看選秀 ADP
- 選秀價值分析

### 5. **Team Matchups History**
```typescript
GET /team/{team_key}/matchups
```

**用途：**
- 完整對戰歷史
- 對戰統計分析

### 6. **League Scoreboard (記分板)**
```typescript
GET /league/{league_key}/scoreboard;week={week}
```

**用途：**
- 查看所有對戰結果
- 聯盟整體表現概覽

### 7. **Stat Categories (統計類別定義)**
```typescript
GET /game/{game_key}/stat_categories
```

**用途：**
- 了解每個 stat_id 的定義
- 動態顯示統計名稱

---

## 🚀 建議的下一步功能

### 優先度 1 - 熱門球員追蹤
```typescript
// 使用 lastweek stats 找出最近表現好的球員
const hotPlayers = await fetchPlayerStats('lastweek')
```

### 優先度 2 - 交易分析
```typescript
// 追蹤聯盟交易活動
const transactions = await getLeagueTransactions()
// 分析哪些球員被頻繁加入/釋出
```

### 優先度 3 - 球員擁有率
```typescript
// 找出被低估的球員（高表現、低擁有率）
const ownership = await getPlayerOwnership(playerKey)
```

### 優先度 4 - 選秀分析
```typescript
// 查看選秀價值 vs 實際表現
const draftAnalysis = await getPlayerDraftAnalysis(playerKey)
```

---

## 📝 總結

### 我們目前已實作 ✅
- ✅ 球員整季統計 (`type=season`)
- ✅ 球員逐日統計 (`type=date;date=YYYY-MM-DD`)
- ✅ Roster 查詢
- ✅ Team 資訊
- ✅ League 資訊
- ✅ Free agents

### 可以輕鬆新增的功能 🎯
- 🎯 `type=lastweek` / `type=lastmonth` - 近期表現
- 🎯 Transactions API - 交易記錄
- 🎯 Player ownership - 擁有率
- 🎯 Draft analysis - 選秀分析
- 🎯 Matchups history - 對戰歷史
- 🎯 Scoreboard - 記分板
- 🎯 Stat categories - 統計類別定義

### 架構優勢 💪
我們目前的架構完全支援這些功能：
- 只需要添加新的 API routes
- Supabase cache layer 可以直接套用
- 前端組件可以重用現有設計

---

## 參考資源

- **yfpy (Python)**: https://github.com/uberfastman/yfpy
- **yahoo-fantasy (Node.js)**: https://github.com/whatadewitt/yahoo-fantasy-sports-api
- **官方文檔**: https://developer.yahoo.com/fantasysports/guide/
- **Node wrapper 文檔**: https://yahoo-fantasy-node-docs.vercel.app/
