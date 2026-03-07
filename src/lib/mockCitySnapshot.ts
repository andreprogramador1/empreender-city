/**
 * Mock do snapshot da cidade: gera devs por distrito (exceto empreender)
 * no mesmo formato do cron city-snapshot. Útil para desenvolvimento sem Supabase.
 */

/** Ative para usar dados mock; desative para baixar snapshot real do Supabase (ou fallback chunked). */
export const USE_MOCK_CITY_SNAPSHOT = false;

const MOCK_DISTRICTS = [
  "nuvemshop",
  "google_analytics",
  "meta",
  "yampi",
  "loja_integrada",
  "tiktok_shop",
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
    const count = 15 + Math.floor(Math.random() * 25);
    for (let i = 0; i < count; i++) {
      const contributions = Math.floor(Math.random() * 5000);
      const totalStars = Math.floor(Math.random() * 2000);
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
        primary_language: ["TypeScript", "JavaScript", "Python", "Go", "Rust", null][
          Math.floor(Math.random() * 6)
        ],
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
        contributions_total: contributions + Math.floor(Math.random() * 500),
        contribution_years: [2023, 2024],
        total_prs: Math.floor(Math.random() * 200),
        total_reviews: Math.floor(Math.random() * 100),
        repos_contributed_to: Math.floor(Math.random() * 50),
        followers: Math.floor(Math.random() * 500),
        following: Math.floor(Math.random() * 200),
        organizations_count: Math.floor(Math.random() * 5),
        account_created_at: "2020-01-01T00:00:00Z",
        current_streak: Math.floor(Math.random() * 30),
        active_days_last_year: Math.floor(Math.random() * 200),
        language_diversity: 1 + Math.floor(Math.random() * 5),
        app_streak: 0,
        raid_xp: 0,
        current_week_contributions: Math.floor(Math.random() * 50),
        current_week_kudos_given: 0,
        current_week_kudos_received: 0,
        active_raid_tag: null,
        rabbit_completed: false,
        xp_total: Math.floor(Math.random() * 5000),
        xp_level: 1 + Math.floor(Math.random() * 10),
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
