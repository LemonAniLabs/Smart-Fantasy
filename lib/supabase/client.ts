import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Create client with default values if not configured
// This allows the app to build without Supabase configured
// The actual API calls will handle the missing configuration gracefully
export const supabase = supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')
  ? createClient(supabaseUrl, supabaseKey)
  : null

export const isSupabaseConfigured = () => {
  return supabase !== null
}

// ============================================================================
// Database Types
// ============================================================================

export interface PlayerGameLog {
  id: string
  player_key: string
  player_name: string
  game_date: string
  stats: Record<string, number>
  opponent?: string
  home_away?: 'home' | 'away'
  minutes_played?: number
  game_result?: 'W' | 'L' | 'T'
  created_at: string
  updated_at: string
}

export interface PlayerAnalytics {
  id: string
  player_key: string
  player_name: string
  analysis_date: string

  // Trend Detection
  trend?: 'hot' | 'cold' | 'stable'
  trend_confidence?: number
  trend_reasons?: string[]

  // Value Analysis
  value_score?: number
  consistency_score?: number
  upside_potential?: number

  // Performance Metrics
  last_7_avg?: Record<string, number>
  last_14_avg?: Record<string, number>
  last_30_avg?: Record<string, number>
  season_avg?: Record<string, number>

  // Recommendations
  recommendation?: 'must_add' | 'strong_add' | 'monitor' | 'drop' | 'hold'
  recommendation_reasons?: string[]

  created_at: string
  updated_at: string
}

export interface LeagueTransaction {
  id: string
  league_key: string
  transaction_id: string
  transaction_type: 'add' | 'drop' | 'trade' | 'commish'
  player_key: string
  player_name: string
  team_key?: string
  team_name?: string
  transaction_date: string
  week_number?: number
  waiver_priority?: number
  trade_partner_team_key?: string
  raw_data?: Record<string, unknown>
  created_at: string
}

export interface PlayerOwnershipHistory {
  id: string
  player_key: string
  player_name: string
  week_number: number
  season: string
  ownership_percentage?: number
  add_count?: number
  drop_count?: number
  ownership_change?: number
  trending_up?: boolean
  created_at: string
}

export interface UserAnalysisState {
  id: string
  user_id: string
  watched_players?: string[]
  custom_alerts?: Array<{
    player_key: string
    condition: string
    enabled: boolean
  }>
  analysis_preferences?: {
    show_advanced_stats?: boolean
    default_time_range?: string
    [key: string]: unknown
  }
  last_viewed_analysis?: string
  favorite_players?: string[]
  created_at: string
  updated_at: string
}

export interface UserMembership {
  id: string
  user_id: string
  tier: 'free' | 'supporter' | 'premium'
  status: 'active' | 'expired' | 'cancelled'
  started_at: string
  expires_at?: string
  payment_provider?: 'kofi' | 'stripe' | 'manual'
  payment_id?: string
  amount?: number
  currency?: string
  api_calls_today?: number
  api_calls_reset_at?: string
  created_at: string
  updated_at: string
}

export interface AnalyticsCache {
  id: string
  cache_key: string
  cache_type: 'hot_players' | 'cold_players' | 'waiver_targets' | 'value_picks' | 'matchup_preview' | 'team_analysis' | 'league_trends'
  league_key?: string
  team_key?: string
  week_number?: number
  data: Record<string, unknown>
  expires_at: string
  computation_time_ms?: number
  created_at: string
}

export interface WaiverWirePriority {
  id: string
  league_key: string
  week_number: number
  player_key: string
  player_name: string
  priority_score: number
  recent_performance_score?: number
  schedule_strength_score?: number
  ownership_trend_score?: number
  injury_replacement?: boolean
  add_probability?: number
  tier?: 'must_add' | 'strong_add' | 'watch' | 'deep_league'
  reasoning?: Record<string, unknown>
  computed_at: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get user's membership tier
 */
export async function getUserTier(userId: string): Promise<'free' | 'supporter' | 'premium'> {
  if (!supabase) return 'free'

  try {
    const { data, error } = await supabase
      .rpc('get_user_tier', { user_id_param: userId })

    if (error) {
      console.error('Error getting user tier:', error)
      return 'free'
    }

    return data || 'free'
  } catch (error) {
    console.error('Error in getUserTier:', error)
    return 'free'
  }
}

/**
 * Check if user is within rate limit
 */
export async function checkRateLimit(userId: string): Promise<boolean> {
  if (!supabase) return true // Allow if Supabase not configured

  try {
    const { data, error } = await supabase
      .rpc('check_rate_limit', { user_id_param: userId })

    if (error) {
      console.error('Error checking rate limit:', error)
      return true // Allow on error
    }

    return data || true
  } catch (error) {
    console.error('Error in checkRateLimit:', error)
    return true
  }
}

/**
 * Increment API call counter for user
 */
export async function incrementApiCalls(userId: string): Promise<void> {
  if (!supabase) return

  try {
    const { error } = await supabase
      .rpc('increment_api_calls', { user_id_param: userId })

    if (error) {
      console.error('Error incrementing API calls:', error)
    }
  } catch (error) {
    console.error('Error in incrementApiCalls:', error)
  }
}

/**
 * Get analytics cache by key
 */
export async function getAnalyticsCache(cacheKey: string): Promise<AnalyticsCache | null> {
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('analytics_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      console.error('Error getting analytics cache:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in getAnalyticsCache:', error)
    return null
  }
}

/**
 * Set analytics cache
 */
export async function setAnalyticsCache(
  cacheKey: string,
  cacheType: AnalyticsCache['cache_type'],
  data: Record<string, unknown>,
  ttlSeconds: number = 3600
): Promise<void> {
  if (!supabase) return

  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()

    const { error } = await supabase
      .from('analytics_cache')
      .upsert({
        cache_key: cacheKey,
        cache_type: cacheType,
        data,
        expires_at: expiresAt
      }, {
        onConflict: 'cache_key'
      })

    if (error) {
      console.error('Error setting analytics cache:', error)
    }
  } catch (error) {
    console.error('Error in setAnalyticsCache:', error)
  }
}
