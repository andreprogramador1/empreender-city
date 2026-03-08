-- ============================================================
-- Profiles: one row per auth user, authorization + stores sync
-- ============================================================

-- 1. profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id                       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  allow_data_for_buildings boolean NOT NULL DEFAULT false,
  stores_synced_at         timestamptz,
  dash_user_id             bigint
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- 2. Optional: flag for snapshot refresh (cron clears after run)
ALTER TABLE city_stats
  ADD COLUMN IF NOT EXISTS snapshot_refresh_requested_at timestamptz;

-- 3. RPC: first developer by name whose owner authorized (or unclaimed)
CREATE OR REPLACE FUNCTION get_developer_by_name_authorized(p_name text)
RETURNS SETOF developers
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.*
  FROM developers d
  LEFT JOIN profiles p ON d.claimed_by = p.id
  WHERE LOWER(TRIM(d.name)) = LOWER(TRIM(p_name))
    AND (d.claimed_by IS NULL OR p.allow_data_for_buildings = true)
  ORDER BY d.id
  LIMIT 1;
$$;

-- 4. get_city_snapshot: only include developers that are unclaimed or owner authorized
CREATE OR REPLACE FUNCTION get_city_snapshot()
RETURNS json
LANGUAGE sql
STABLE
SET statement_timeout = '60s'
AS $$
  SELECT json_build_object(
    'developers', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT d.id, d.github_login, d.name, d.avatar_url, d.contributions, d.total_stars,
               d.public_repos, d.primary_language, d.rank, d.claimed,
               COALESCE(d.kudos_count, 0) AS kudos_count,
               COALESCE(d.visit_count, 0) AS visit_count,
               d.contributions_total, d.contribution_years, d.total_prs, d.total_reviews,
               d.repos_contributed_to, d.followers, d.following, d.organizations_count,
               d.account_created_at, d.current_streak, d.active_days_last_year,
               d.language_diversity,
               COALESCE(d.app_streak, 0) AS app_streak,
               COALESCE(d.rabbit_completed, false) AS rabbit_completed,
               d.district, d.district_chosen,
               COALESCE(d.raid_xp, 0) AS raid_xp,
               COALESCE(d.current_week_contributions, 0) AS current_week_contributions,
               COALESCE(d.current_week_kudos_given, 0) AS current_week_kudos_given,
               COALESCE(d.current_week_kudos_received, 0) AS current_week_kudos_received,
               COALESCE(d.xp_total, 0) AS xp_total,
               COALESCE(d.xp_level, 1) AS xp_level
        FROM developers d
        LEFT JOIN profiles p ON d.claimed_by = p.id
        WHERE d.claimed_by IS NULL OR p.allow_data_for_buildings = true
        ORDER BY d.rank ASC
      ) t
    ),
    'purchases', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT developer_id, item_id
        FROM purchases
        WHERE status = 'completed' AND gifted_to IS NULL
      ) t
    ),
    'gift_purchases', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT gifted_to, item_id
        FROM purchases
        WHERE status = 'completed' AND gifted_to IS NOT NULL
      ) t
    ),
    'customizations', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT developer_id, item_id, config
        FROM developer_customizations
        WHERE item_id IN ('custom_color', 'billboard', 'loadout')
      ) t
    ),
    'achievements', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT developer_id, achievement_id
        FROM developer_achievements
      ) t
    ),
    'raid_tags', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT building_id, attacker_login, tag_style, expires_at
        FROM raid_tags
        WHERE active = true
      ) t
    ),
    'stats', (
      SELECT row_to_json(t)
      FROM (SELECT * FROM city_stats WHERE id = 1) t
    )
  );
$$;
