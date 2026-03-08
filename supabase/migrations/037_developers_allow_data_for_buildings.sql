-- ============================================================
-- developers.allow_data_for_buildings: mirror profile flag for
-- cheaper filtering (no JOIN with profiles)
-- ============================================================

-- 1. Add column
ALTER TABLE developers
  ADD COLUMN IF NOT EXISTS allow_data_for_buildings boolean NOT NULL DEFAULT false;

-- 2. Backfill from profiles (claimed developers get owner's value)
UPDATE developers d
SET allow_data_for_buildings = p.allow_data_for_buildings
FROM profiles p
WHERE d.claimed_by = p.id;

-- 3. Partial index for city list + snapshot: only rows visible in city, ordered by rank.
--    Used by GET /api/city and cron city-snapshot (.or(claimed_by.is.null, allow_data_for_buildings.eq.true) + order by rank).
CREATE INDEX IF NOT EXISTS idx_developers_allow_data_rank
  ON developers (rank)
  WHERE claimed_by IS NULL OR allow_data_for_buildings = true;

-- 4. RPC: use developers.allow_data_for_buildings (no JOIN profiles)
CREATE OR REPLACE FUNCTION get_developer_by_name_authorized(p_name text)
RETURNS SETOF developers
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.*
  FROM developers d
  WHERE LOWER(TRIM(d.name)) = LOWER(TRIM(p_name))
    AND (d.claimed_by IS NULL OR d.allow_data_for_buildings = true)
  ORDER BY d.id
  LIMIT 1;
$$;

-- 5. get_city_snapshot: use developers.allow_data_for_buildings (no JOIN profiles)
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
        WHERE d.claimed_by IS NULL OR d.allow_data_for_buildings = true
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
