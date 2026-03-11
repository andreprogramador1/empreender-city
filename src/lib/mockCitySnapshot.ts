/**
 * Mock do snapshot da cidade: gera devs por distrito (exceto empreender)
 * no mesmo formato do cron city-snapshot. Útil para desenvolvimento sem Supabase.
 */

/** Ative para usar dados mock; desative para baixar snapshot real do Supabase (ou fallback chunked). */
export const USE_MOCK_CITY_SNAPSHOT = process.env.NEXT_PUBLIC_MOCK_CITY_SNAPSHOT === "true" ? true : false;

const MOCK_DISTRICTS = [
  "nuvemshop",
  "googleanalytics4",
  "meta",
  "yampi",
  "lojaintegrada",
  "tiktokshop",
  "tray",
  "shopify",
  "bling",
  "kiwify",
  "montink",
] as const;

export interface MockCitySnapshot {
  developers: Record<string, unknown>[];
  stats: { total_developers: number; total_contributions: number };
  generated_at: string;
}

export function getMockCitySnapshot(): MockCitySnapshot {
  const developers: Record<string, unknown>[] = [];
  let totalContributions = 0;
  let id = 1;
  const now = new Date().toISOString();

  for (const district of MOCK_DISTRICTS) {
    const count = 200 + Math.floor(Math.random() * 25);
    for (let i = 0; i < count; i++) {
      const contributions = Math.floor(Math.random() * 5000);
      const totalStars = 0;
      const publicRepos = 5 + Math.floor(Math.random() * 80);
      totalContributions += contributions;
      const login = `dev-${district}-${i + 1}-${Math.random().toString(36).slice(2, 8)}`;
      developers.push({
        id: id++,
        github_login: login,
        github_id: 10000 + id,
        name: `Dev ${district.replace("_", " ")} ${i + 1}`,
        avatar_url: null,
        bio: null,
        contributions,
        public_repos: publicRepos,
        total_stars: totalStars,
        primary_language: [],
        rank: id,
        fetched_at: now,
        created_at: now,
        claimed: false,
        fetch_priority: 0,
        claimed_at: null,
        district,
        district_chosen: true,
        kudos_count: 0,
        visit_count: 0,
        owned_items: [],
        custom_color: null,
        billboard_images: [],
        achievements: [],
        loadout: null,
        contributions_total: 0,
        contribution_years: [],
        total_prs: 0,
        total_reviews: 0,
        repos_contributed_to: 0,
        followers: 0,
        following: 0,
        organizations_count: 0,
        account_created_at: "2020-01-01T00:00:00Z",
        current_streak: 0,
        active_days_last_year: 0,
        language_diversity: 0,
        app_streak: 0,
        raid_xp: 0,
        current_week_contributions: 0,
        current_week_kudos_given: 0,
        current_week_kudos_received: 0,
        active_raid_tag: null,
        rabbit_completed: false,
        xp_total: 0,
        xp_level: 1,
      });
    }
  }

  return {
    developers,
    stats: {
      total_developers: developers.length,
      total_contributions: totalContributions,
    },
    generated_at: now,
  };
}
