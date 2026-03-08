-- ============================================================
-- Unique constraint on profiles.dash_user_id for Dash auth lookup
-- ============================================================

-- Only one profile per Dash user; lookup by dash_user_id must be deterministic
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_dash_user_id_unique
  ON profiles (dash_user_id)
  WHERE dash_user_id IS NOT NULL;
