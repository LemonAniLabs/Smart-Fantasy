-- Player Game Logs Cache Table
-- Stores individual game statistics for each player
CREATE TABLE IF NOT EXISTS player_game_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_key TEXT NOT NULL,
  player_name TEXT NOT NULL,
  game_date DATE NOT NULL,
  stats JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one record per player per game date
  UNIQUE(player_key, game_date)
);

-- Index for faster queries by player_key
CREATE INDEX IF NOT EXISTS idx_player_game_logs_player_key
ON player_game_logs(player_key);

-- Index for faster queries by game_date
CREATE INDEX IF NOT EXISTS idx_player_game_logs_game_date
ON player_game_logs(game_date DESC);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_player_game_logs_player_date
ON player_game_logs(player_key, game_date DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_player_game_logs_updated_at
  BEFORE UPDATE ON player_game_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Optional: Add Row Level Security (RLS) policies
-- Uncomment if you want to enable RLS
-- ALTER TABLE player_game_logs ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all authenticated users to read
-- CREATE POLICY "Allow authenticated users to read game logs"
--   ON player_game_logs
--   FOR SELECT
--   TO authenticated
--   USING (true);

-- Create a policy that allows service role to write
-- CREATE POLICY "Allow service role to insert game logs"
--   ON player_game_logs
--   FOR INSERT
--   TO service_role
--   WITH CHECK (true);

-- Create a policy that allows service role to update
-- CREATE POLICY "Allow service role to update game logs"
--   ON player_game_logs
--   FOR UPDATE
--   TO service_role
--   USING (true);
