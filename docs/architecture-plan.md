# Fantasy Basketball AI - 完整架構規劃

## 🎯 產品願景

打造一個 **數據驅動的 Fantasy Basketball 分析平台**，提供：
- 全面的球員表現數據收集（day-by-day）
- 深度分析引擎（熱門球員、價值分析、趨勢預測）
- 個人化分析狀態儲存
- 會員訂閱制營利模式

---

## 🏗️ 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Dashboard  │  │   Analytics  │  │  Player Card │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js API Routes)            │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ Yahoo API  │  │ NBA Stats  │  │ Analytics  │           │
│  │  Wrapper   │  │    API     │  │   Engine   │           │
│  └────────────┘  └────────────┘  └────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer (Supabase)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐      │
│  │  Raw Data Storage (Game Logs, Transactions...)   │      │
│  └──────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────┐      │
│  │  Analytics Cache (Computed Insights)             │      │
│  └──────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────┐      │
│  │  User State (Preferences, Analysis History)      │      │
│  └──────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────┐      │
│  │  Membership (Tiers, Usage, Payments)             │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  External Services                           │
├─────────────────────────────────────────────────────────────┤
│  Yahoo Fantasy API  │  NBA Stats API  │  Ko-fi / Stripe     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 數據收集策略

### Day-by-Day 全面收集

```typescript
// 每日自動化收集流程
1. 收集所有聯盟球員的當日數據
2. 儲存到 Supabase (player_game_logs)
3. 檢測重要事件 (傷病、交易、突破性表現)
4. 更新分析快取 (computed metrics)
5. 觸發通知 (如果有重要變化)
```

### 收集範圍

| 數據類型 | 收集頻率 | 保存期限 | 用途 |
|---------|---------|---------|------|
| **Game Logs** | 每日 | 永久 | 趨勢分析、歷史對比 |
| **Transactions** | 即時 | 永久 | Waiver wire 分析 |
| **Ownership** | 每週 | 永久 | 價值分析 |
| **Matchups** | 每週 | 當季 | 對戰策略 |
| **Rankings** | 每日 | 當季 | 排名追蹤 |

---

## 🧠 分析功能模塊

### 1. 熱門/冷門球員偵測 🔥❄️

```typescript
// 分析邏輯
interface TrendAnalysis {
  player_key: string
  trend: 'hot' | 'cold' | 'stable'
  confidence: number  // 0-100

  metrics: {
    last_7_days_avg: Stats
    last_30_days_avg: Stats
    season_avg: Stats
    improvement_percentage: number
  }

  reasons: string[]  // ["PTS +15%", "FG% improved", ...]
}

// 偵測條件
- Hot: 近 7 天表現 > 賽季平均 15%+
- Cold: 近 7 天表現 < 賽季平均 15%+
- 考慮多個統計類別（PTS, REB, AST, FG%, etc.）
```

### 2. 價值分析 💎

```typescript
interface ValueAnalysis {
  player_key: string
  value_score: number  // 0-100

  factors: {
    performance_vs_adp: number     // 實際表現 vs 選秀順位
    ownership_percentage: number   // 擁有率
    consistency_score: number      // 穩定性
    upside_potential: number       // 上升潛力
  }

  recommendation: 'must_add' | 'strong_add' | 'monitor' | 'drop'
}
```

### 3. Waiver Wire 優先級 📋

```typescript
interface WaiverPriority {
  player_key: string
  priority: number  // 1-10

  analysis: {
    recent_performance: number
    schedule_strength: number
    injury_replacement: boolean
    trending_up: boolean
  }

  add_probability: number  // 被加入的可能性 (0-100%)
}
```

### 4. 對戰策略建議 ⚔️

```typescript
interface MatchupStrategy {
  week: number
  my_team_key: string
  opponent_team_key: string

  predictions: {
    win_probability: number
    close_categories: string[]  // 可能決勝的類別
    streaming_spots: number     // 可用的 streaming 名額
  }

  recommendations: {
    must_start: string[]        // 必須先發的球員
    sit_candidates: string[]    // 可以坐板凳的球員
    streaming_targets: string[] // Streaming 目標
  }
}
```

### 5. 交易分析 🔄

```typescript
interface TradeAnalysis {
  giving: string[]  // 送出的球員
  receiving: string[]  // 得到的球員

  impact: {
    overall_score_change: number
    category_impacts: Record<string, number>
    roster_balance: number
    playoff_impact: number
  }

  recommendation: 'accept' | 'reject' | 'counter'
  reasoning: string[]
}
```

---

## 💾 Supabase 資料表設計

### 核心資料表

#### 1. `player_game_logs` (已存在，擴充)
```sql
- id: uuid
- player_key: text
- player_name: text
- game_date: date
- stats: jsonb
- opponent: text (新增)
- home_away: text (新增)
- minutes_played: integer (新增)
- game_result: text (新增: 'W' | 'L')
- created_at: timestamp
- updated_at: timestamp
```

#### 2. `player_analytics` (新增)
```sql
- id: uuid
- player_key: text
- analysis_date: date
-
- trend: text ('hot' | 'cold' | 'stable')
- trend_confidence: integer
- value_score: integer
-
- last_7_avg: jsonb
- last_14_avg: jsonb
- last_30_avg: jsonb
- season_avg: jsonb
-
- consistency_score: integer
- upside_potential: integer
-
- created_at: timestamp
```

#### 3. `league_transactions` (新增)
```sql
- id: uuid
- league_key: text
- transaction_id: text
- transaction_type: text ('add' | 'drop' | 'trade')
- player_key: text
- team_key: text
- timestamp: timestamp
-
- waiver_priority: integer (if applicable)
-
- created_at: timestamp
```

#### 4. `player_ownership_history` (新增)
```sql
- id: uuid
- player_key: text
- week: integer
- season: text
-
- ownership_percentage: decimal
- add_count: integer
- drop_count: integer
-
- created_at: timestamp
```

#### 5. `user_analysis_state` (新增)
```sql
- id: uuid
- user_id: text (Yahoo GUID)
-
- watched_players: jsonb (array of player_keys)
- custom_alerts: jsonb
- analysis_preferences: jsonb
-
- last_viewed_analysis: timestamp
- created_at: timestamp
- updated_at: timestamp
```

#### 6. `user_memberships` (新增)
```sql
- id: uuid
- user_id: text (Yahoo GUID)
-
- tier: text ('free' | 'supporter' | 'premium')
- status: text ('active' | 'expired' | 'cancelled')
-
- started_at: timestamp
- expires_at: timestamp
-
- payment_provider: text ('kofi' | 'stripe')
- payment_id: text
-
- created_at: timestamp
- updated_at: timestamp
```

#### 7. `analytics_cache` (新增)
```sql
- id: uuid
- cache_key: text (unique)
- cache_type: text ('hot_players' | 'waiver_targets' | 'matchup_preview')
-
- data: jsonb
- expires_at: timestamp
-
- created_at: timestamp
```

---

## 🎨 UI/UX 設計

### 新增頁面

#### 1. Analytics Dashboard (`/analytics`)
```
┌─────────────────────────────────────────┐
│  🔥 Hot Players    │  ❄️ Cold Players  │
├─────────────────────────────────────────┤
│  💎 Top Value Picks                     │
├─────────────────────────────────────────┤
│  📊 Your Team Analysis                  │
├─────────────────────────────────────────┤
│  📋 Waiver Wire Priorities              │
└─────────────────────────────────────────┘
```

#### 2. Player Deep Dive (`/player/[key]`)
```
┌─────────────────────────────────────────┐
│  Player Header (name, team, position)   │
├─────────────────────────────────────────┤
│  📈 Trend Chart (last 30 games)         │
├─────────────────────────────────────────┤
│  🎯 Analysis                             │
│  - Hot/Cold status                      │
│  - Value score                          │
│  - Consistency rating                   │
├─────────────────────────────────────────┤
│  📊 Stats Breakdown                     │
│  - Season avg vs Recent                 │
│  - Category splits                      │
└─────────────────────────────────────────┘
```

#### 3. Waiver Wire Assistant (`/waiver`)
```
┌─────────────────────────────────────────┐
│  🎯 Top Targets (ranked by priority)    │
├─────────────────────────────────────────┤
│  📊 Trending Up                         │
├─────────────────────────────────────────┤
│  💡 Deep Sleepers                       │
├─────────────────────────────────────────┤
│  ⚠️ Drop Candidates                     │
└─────────────────────────────────────────┘
```

---

## 💰 營利模式設計

### 會員分層

| 功能 | Free | Supporter ($5/月) | Premium ($10/月) |
|------|------|------------------|-----------------|
| 基本數據查看 | ✅ | ✅ | ✅ |
| 球員比賽紀錄 | 最近 5 場 | 最近 20 場 | 全部 |
| 熱門/冷門偵測 | ❌ | ✅ | ✅ |
| 價值分析 | ❌ | ✅ | ✅ |
| Waiver 優先級 | 前 5 名 | 前 20 名 | 全部 |
| 對戰策略建議 | ❌ | 基礎 | 進階 |
| 交易分析器 | ❌ | ❌ | ✅ |
| 自訂通知 | ❌ | ❌ | ✅ |
| 歷史數據匯出 | ❌ | ❌ | ✅ |
| API 使用次數 | 100/天 | 500/天 | 無限 |

### 付費整合

#### Ko-fi Integration
```typescript
// Ko-fi webhook endpoint
POST /api/payment/kofi-webhook

// Verify payment and upgrade user
- Check Ko-fi signature
- Find user by email
- Upgrade membership tier
- Send confirmation email
```

#### Stripe Integration (備選)
```typescript
// Stripe subscription
- Create checkout session
- Handle webhook events
- Manage recurring billing
- Handle cancellations
```

---

## 🔄 數據更新策略

### 自動化流程

```typescript
// Cron jobs (使用 Vercel Cron 或 GitHub Actions)

1. Daily at 9:00 AM ET (比賽結束後)
   - Collect previous day game logs
   - Update player analytics
   - Refresh hot/cold detection
   - Update ownership data

2. Weekly on Monday 6:00 AM ET
   - Collect weekly transactions
   - Update waiver wire priorities
   - Generate matchup previews
   - Clear stale cache

3. Real-time (on demand)
   - User-triggered analysis
   - Trade evaluation
   - Custom queries
```

---

## 🚀 實作優先級

### Phase 1: 核心數據收集 (1-2 週)
- ✅ Supabase schema 建立
- ✅ Day-by-day 收集系統
- ✅ Transaction 追蹤
- ✅ Ownership 追蹤

### Phase 2: 分析引擎 (2-3 週)
- ✅ 熱門/冷門偵測
- ✅ 價值分析算法
- ✅ Waiver 優先級
- ✅ Analytics cache layer

### Phase 3: UI/UX (1-2 週)
- ✅ Analytics Dashboard
- ✅ Player Deep Dive 頁面
- ✅ Waiver Assistant

### Phase 4: 會員系統 (1 週)
- ✅ User membership 表
- ✅ Ko-fi 整合
- ✅ Feature gating
- ✅ Usage tracking

### Phase 5: 優化與上線 (1 週)
- ✅ 效能優化
- ✅ 測試
- ✅ 文檔
- ✅ 正式上線

---

## 📊 成功指標

### 技術指標
- API 回應時間 < 500ms (90th percentile)
- Cache hit rate > 80%
- 數據完整性 > 99%
- 系統可用性 > 99.9%

### 產品指標
- DAU (Daily Active Users)
- Conversion rate (Free → Paid)
- Retention rate (7-day, 30-day)
- NPS (Net Promoter Score)

---

## 🔐 安全性考量

1. **API Rate Limiting**
   - Free: 100 requests/day
   - Supporter: 500 requests/day
   - Premium: Unlimited (with abuse detection)

2. **Data Privacy**
   - User data encryption at rest
   - GDPR compliance
   - Right to deletion

3. **Payment Security**
   - Use established providers (Ko-fi/Stripe)
   - No storage of payment details
   - Webhook signature verification

---

這份架構規劃涵蓋了：
✅ 完整的系統架構
✅ 數據收集策略
✅ 分析功能設計
✅ Supabase schema
✅ UI/UX 設計
✅ 營利模式
✅ 實作優先級

接下來我們可以開始實作！
