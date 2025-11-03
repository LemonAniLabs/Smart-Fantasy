-- ============================================================================
-- Fantasy Basketball AI - Analytics Platform Schema
-- ============================================================================
-- This schema extends the base schema with analytics and membership features
-- Run this AFTER running schema.sql
-- ============================================================================

-- ============================================================================
-- 1. PLAYER ANALYTICS TABLE
-- ============================================================================
-- Stores computed analytics for each player (trend detection, value scores, etc.)

CREATE TABLE IF NOT EXISTS player_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_key TEXT NOT NULL,
  player_name TEXT NOT NULL,
  analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Trend Detection
  trend TEXT CHECK (trend IN ('hot', 'cold', 'stable')),
  trend_confidence INTEGER CHECK (trend_confidence BETWEEN 0 AND 100),
  trend_reasons JSONB, -- Array of reasons: ["PTS +15%", "FG% improved"]

  -- Value Analysis
  value_score INTEGER CHECK (value_score BETWEEN 0 AND 100),
  consistency_score INTEGER CHECK (consistency_score BETWEEN 0 AND 100),
  upside_potential INTEGER CHECK (upside_potential BETWEEN 0 AND 100),

  -- Performance Metrics (Averages)
  last_7_avg JSONB,   -- Average stats over last 7 days
  last_14_avg JSONB,  -- Average stats over last 14 days
  last_30_avg JSONB,  -- Average stats over last 30 days
  season_avg JSONB,   -- Season average stats

  -- Recommendations
  recommendation TEXT CHECK (recommendation IN ('must_add', 'strong_add', 'monitor', 'drop', 'hold')),
  recommendation_reasons JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one analysis per player per date
  UNIQUE(player_key, analysis_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_player_analytics_player_key
  ON player_analytics(player_key);

CREATE INDEX IF NOT EXISTS idx_player_analytics_date
  ON player_analytics(analysis_date DESC);

CREATE INDEX IF NOT EXISTS idx_player_analytics_trend
  ON player_analytics(trend) WHERE trend IN ('hot', 'cold');

CREATE INDEX IF NOT EXISTS idx_player_analytics_value
  ON player_analytics(value_score DESC) WHERE value_score > 70;

-- Trigger for updated_at
CREATE TRIGGER update_player_analytics_updated_at
  BEFORE UPDATE ON player_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. LEAGUE TRANSACTIONS TABLE
-- ============================================================================
-- Tracks all adds, drops, and trades in the league

CREATE TABLE IF NOT EXISTS league_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_key TEXT NOT NULL,
  transaction_id TEXT NOT NULL, -- Yahoo transaction ID

  -- Transaction Details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('add', 'drop', 'trade', 'commish')),
  player_key TEXT NOT NULL,
  player_name TEXT NOT NULL,
  team_key TEXT,
  team_name TEXT,

  -- Timing
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  week_number INTEGER,

  -- Additional Context
  waiver_priority INTEGER, -- If waiver claim
  trade_partner_team_key TEXT, -- If trade

  -- Metadata
  raw_data JSONB, -- Store full Yahoo API response
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(league_key, transaction_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_league_transactions_league
  ON league_transactions(league_key);

CREATE INDEX IF NOT EXISTS idx_league_transactions_player
  ON league_transactions(player_key);

CREATE INDEX IF NOT EXISTS idx_league_transactions_type
  ON league_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_league_transactions_date
  ON league_transactions(transaction_date DESC);

-- ============================================================================
-- 3. PLAYER OWNERSHIP HISTORY TABLE
-- ============================================================================
-- Tracks ownership percentages over time

CREATE TABLE IF NOT EXISTS player_ownership_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_key TEXT NOT NULL,
  player_name TEXT NOT NULL,

  -- Time Period
  week_number INTEGER NOT NULL,
  season TEXT NOT NULL, -- e.g., "2024-25"

  -- Ownership Stats
  ownership_percentage DECIMAL(5,2) CHECK (ownership_percentage BETWEEN 0 AND 100),
  add_count INTEGER DEFAULT 0,
  drop_count INTEGER DEFAULT 0,

  -- Trends
  ownership_change DECIMAL(5,2), -- Change from previous week
  trending_up BOOLEAN,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(player_key, season, week_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ownership_player_week
  ON player_ownership_history(player_key, week_number DESC);

CREATE INDEX IF NOT EXISTS idx_ownership_trending
  ON player_ownership_history(trending_up) WHERE trending_up = true;

-- ============================================================================
-- 4. USER ANALYSIS STATE TABLE
-- ============================================================================
-- Stores user preferences and analysis history

CREATE TABLE IF NOT EXISTS user_analysis_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE, -- Yahoo GUID

  -- Watched Players
  watched_players JSONB DEFAULT '[]'::jsonb, -- Array of player_keys

  -- Custom Alerts
  custom_alerts JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"player_key": "xxx", "condition": "pts > 25", "enabled": true}]

  -- Preferences
  analysis_preferences JSONB DEFAULT '{}'::jsonb,
  -- Example: {"show_advanced_stats": true, "default_time_range": "last14"}

  -- Activity Tracking
  last_viewed_analysis TIMESTAMP WITH TIME ZONE,
  favorite_players JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_state_user_id
  ON user_analysis_state(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_state_updated_at
  BEFORE UPDATE ON user_analysis_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. USER MEMBERSHIPS TABLE
-- ============================================================================
-- Tracks user subscription tiers and payment status

CREATE TABLE IF NOT EXISTS user_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Yahoo GUID

  -- Membership Details
  tier TEXT NOT NULL CHECK (tier IN ('free', 'supporter', 'premium')),
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Payment
  payment_provider TEXT CHECK (payment_provider IN ('kofi', 'stripe', 'manual')),
  payment_id TEXT, -- External payment reference
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',

  -- Usage Tracking
  api_calls_today INTEGER DEFAULT 0,
  api_calls_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_memberships_user_id
  ON user_memberships(user_id);

CREATE INDEX IF NOT EXISTS idx_memberships_status
  ON user_memberships(status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_memberships_expires
  ON user_memberships(expires_at) WHERE expires_at IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_memberships_updated_at
  BEFORE UPDATE ON user_memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. ANALYTICS CACHE TABLE
-- ============================================================================
-- Stores computed analytics to reduce API calls and computation

CREATE TABLE IF NOT EXISTS analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  cache_type TEXT NOT NULL CHECK (cache_type IN (
    'hot_players',
    'cold_players',
    'waiver_targets',
    'value_picks',
    'matchup_preview',
    'team_analysis',
    'league_trends'
  )),

  -- Scope (optional filters)
  league_key TEXT,
  team_key TEXT,
  week_number INTEGER,

  -- Data
  data JSONB NOT NULL,

  -- Expiration
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Metadata
  computation_time_ms INTEGER, -- How long it took to compute
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cache_key
  ON analytics_cache(cache_key);

CREATE INDEX IF NOT EXISTS idx_cache_type
  ON analytics_cache(cache_type);

CREATE INDEX IF NOT EXISTS idx_cache_expires
  ON analytics_cache(expires_at);

-- Auto-cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM analytics_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. WAIVER WIRE PRIORITIES TABLE
-- ============================================================================
-- Pre-computed waiver wire recommendations

CREATE TABLE IF NOT EXISTS waiver_wire_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_key TEXT NOT NULL,
  week_number INTEGER NOT NULL,

  -- Player Info
  player_key TEXT NOT NULL,
  player_name TEXT NOT NULL,

  -- Priority Scoring
  priority_score INTEGER NOT NULL CHECK (priority_score BETWEEN 1 AND 100),

  -- Analysis Factors
  recent_performance_score INTEGER,
  schedule_strength_score INTEGER,
  ownership_trend_score INTEGER,
  injury_replacement BOOLEAN DEFAULT false,

  -- Prediction
  add_probability INTEGER CHECK (add_probability BETWEEN 0 AND 100),

  -- Recommendation
  tier TEXT CHECK (tier IN ('must_add', 'strong_add', 'watch', 'deep_league')),
  reasoning JSONB,

  -- Metadata
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(league_key, week_number, player_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_waiver_league_week
  ON waiver_wire_priorities(league_key, week_number);

CREATE INDEX IF NOT EXISTS idx_waiver_priority
  ON waiver_wire_priorities(priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_waiver_tier
  ON waiver_wire_priorities(tier);

-- ============================================================================
-- 8. EXTEND PLAYER_GAME_LOGS TABLE
-- ============================================================================
-- Add new columns to existing player_game_logs table

ALTER TABLE player_game_logs
  ADD COLUMN IF NOT EXISTS opponent TEXT,
  ADD COLUMN IF NOT EXISTS home_away TEXT CHECK (home_away IN ('home', 'away')),
  ADD COLUMN IF NOT EXISTS minutes_played INTEGER,
  ADD COLUMN IF NOT EXISTS game_result TEXT CHECK (game_result IN ('W', 'L', 'T'));

-- ============================================================================
-- 9. HELPER FUNCTIONS
-- ============================================================================

-- Function to get active membership tier for a user
CREATE OR REPLACE FUNCTION get_user_tier(user_id_param TEXT)
RETURNS TEXT AS $$
DECLARE
  user_tier TEXT;
BEGIN
  SELECT tier INTO user_tier
  FROM user_memberships
  WHERE user_id = user_id_param
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY CASE tier
    WHEN 'premium' THEN 1
    WHEN 'supporter' THEN 2
    WHEN 'free' THEN 3
  END
  LIMIT 1;

  RETURN COALESCE(user_tier, 'free');
END;
$$ LANGUAGE plpgsql;

-- Function to check API rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(user_id_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_tier TEXT;
  current_calls INTEGER;
  limit_calls INTEGER;
  reset_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get user tier and current API calls
  SELECT
    get_user_tier(user_id_param),
    api_calls_today,
    api_calls_reset_at
  INTO user_tier, current_calls, reset_time
  FROM user_memberships
  WHERE user_id = user_id_param
  LIMIT 1;

  -- Reset counter if needed
  IF reset_time < NOW() - INTERVAL '1 day' THEN
    UPDATE user_memberships
    SET api_calls_today = 0,
        api_calls_reset_at = NOW()
    WHERE user_id = user_id_param;
    current_calls := 0;
  END IF;

  -- Determine limit based on tier
  limit_calls := CASE user_tier
    WHEN 'free' THEN 100
    WHEN 'supporter' THEN 500
    WHEN 'premium' THEN 999999
    ELSE 100
  END;

  -- Check if under limit
  RETURN current_calls < limit_calls;
END;
$$ LANGUAGE plpgsql;

-- Function to increment API call counter
CREATE OR REPLACE FUNCTION increment_api_calls(user_id_param TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO user_memberships (user_id, tier, status, api_calls_today, api_calls_reset_at)
  VALUES (user_id_param, 'free', 'active', 1, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET api_calls_today = user_memberships.api_calls_today + 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Optional: Enable RLS for user-specific tables

-- Enable RLS on user_analysis_state
ALTER TABLE user_analysis_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analysis state"
  ON user_analysis_state
  FOR SELECT
  TO authenticated
  USING (user_id = current_setting('app.user_id', TRUE));

CREATE POLICY "Users can update their own analysis state"
  ON user_analysis_state
  FOR UPDATE
  TO authenticated
  USING (user_id = current_setting('app.user_id', TRUE));

-- Enable RLS on user_memberships
ALTER TABLE user_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own membership"
  ON user_memberships
  FOR SELECT
  TO authenticated
  USING (user_id = current_setting('app.user_id', TRUE));

-- ============================================================================
-- COMPLETION
-- ============================================================================

-- Grant necessary permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- View summary of created tables
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'player_analytics',
    'league_transactions',
    'player_ownership_history',
    'user_analysis_state',
    'user_memberships',
    'analytics_cache',
    'waiver_wire_priorities',
    'player_game_logs'
  )
ORDER BY table_name;
