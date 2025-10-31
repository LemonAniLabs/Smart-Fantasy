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

// Types for our database tables
export interface PlayerGameLog {
  id: string
  player_key: string
  player_name: string
  game_date: string
  stats: Record<string, number>
  created_at: string
  updated_at: string
}

export interface PlayerGameLogsCache {
  player_key: string
  limit: number
  games_found: number
  requests_made: number
  game_logs: Array<{
    date: string
    stats: Record<string, number>
    hasGame: boolean
  }>
  created_at: string
  expires_at: string
}
