// ─── Types ───────────────────────────────────────────────────

export interface DeveloperRecord {
  id: number;
  github_login: string;
  github_id: number | null;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  contributions: number;
  public_repos: number;
  total_stars: number;
  primary_language: string | null;
  top_repos?: TopRepo[];
  rank: number | null;
  fetched_at: string;
  created_at: string;
  claimed: boolean;
  fetch_priority: number;
  claimed_at: string | null;
  district?: string | null;
  owned_items?: string[];
  custom_color?: string | null;
  billboard_images?: string[];
  // v2 fields (optional for backward compat)
  contributions_total?: number;
  contribution_years?: number[];
  total_prs?: number;
  total_reviews?: number;
  total_issues?: number;
  repos_contributed_to?: number;
  followers?: number;
  following?: number;
  organizations_count?: number;
  account_created_at?: string | null;
  current_streak?: number;
  longest_streak?: number;
  active_days_last_year?: number;
  language_diversity?: number;
  // XP fields
  xp_total?: number;
  xp_level?: number;
  xp_github?: number;
  // Dash store domain (from developers.store_domain)
  store_domain?: string | null;
}

export interface TopRepo {
  name: string;
  stars: number;
  language: string | null;
  url: string;
}

export interface CityBuilding {
  login: string;
  rank: number;
  contributions: number;
  total_stars: number;
  public_repos: number;
  name: string | null;
  avatar_url: string | null;
  primary_language: string | null;
  claimed: boolean;
  owned_items: string[];
  custom_color?: string | null;
  billboard_images?: string[];
  achievements: string[];
  kudos_count: number;
  visit_count: number;
  loadout?: {
    crown: string | null;
    roof: string | null;
    aura: string | null;
  } | null;
  app_streak: number;
  raid_xp: number;
  current_week_contributions: number;
  current_week_kudos_given: number;
  current_week_kudos_received: number;
  active_raid_tag?: {
    attacker_login: string;
    tag_style: string;
    expires_at: string;
  } | null;
  rabbit_completed: boolean;
  xp_total: number;
  xp_level: number;
  district?: string;
  district_chosen?: boolean;
  /** Dash store domain (from developers.store_domain), used for "Ir para loja" link */
  store_domain?: string | null;
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  floors: number;
  windowsPerFloor: number;
  sideWindowsPerFloor: number;
  litPercentage: number;
}

export interface CityPlaza {
  position: [number, number, number];
  size: number;
  variant: number; // 0-1 seeded random for visual variety
}

export interface CityDecoration {
  type:
    | "tree"
    | "streetLamp"
    | "car"
    | "bench"
    | "fountain"
    | "sidewalk"
    | "roadMarking";
  position: [number, number, number];
  rotation: number;
  variant: number;
  size?: [number, number];
}

// ─── Spiral Coordinate ──────────────────────────────────────

function spiralCoord(index: number): [number, number] {
  if (index === 0) return [0, 0];

  let x = 0,
    y = 0,
    dx = 1,
    dy = 0;
  let segLen = 1,
    segPassed = 0,
    turns = 0;

  for (let i = 0; i < index; i++) {
    x += dx;
    y += dy;
    segPassed++;
    if (segPassed === segLen) {
      segPassed = 0;
      // turn left
      const tmp = dx;
      dx = -dy;
      dy = tmp;
      turns++;
      if (turns % 2 === 0) segLen++;
    }
  }
  return [x, y];
}

// ─── City Layout ─────────────────────────────────────────────

const BLOCK_SIZE = 4; // 4x4 buildings per city block
const LOT_W = 38; // lot width  (X axis) — tighter packing
const LOT_D = 32; // lot depth  (Z axis) — tighter packing
const ALLEY_W = 3; // narrow gap between buildings within a block
const STREET_W = 12; // street between blocks (within a district)

// Derived: total block footprint
const BLOCK_FOOTPRINT_X = BLOCK_SIZE * LOT_W + (BLOCK_SIZE - 1) * ALLEY_W; // 4*38 + 3*3 = 161
const BLOCK_FOOTPRINT_Z = BLOCK_SIZE * LOT_D + (BLOCK_SIZE - 1) * ALLEY_W; // 4*32 + 3*3 = 137

const RIVER_MARGIN = 8; // Margin on each side of the river

const MAX_BUILDING_HEIGHT = 500;
const MIN_BUILDING_HEIGHT = 35;
const HEIGHT_RANGE = MAX_BUILDING_HEIGHT - MIN_BUILDING_HEIGHT; // 565

function calcHeight(
  contributions: number,
  totalStars: number,
  publicRepos: number,
  maxContrib: number,
  maxStars: number,
): { height: number; composite: number } {
  const effMaxC = Math.min(maxContrib, 20_000);
  const effMaxS = Math.min(maxStars, 200_000);

  // Normalize to 0-1 (can exceed 1 for outliers)
  const cNorm = contributions / Math.max(1, effMaxC);
  const sNorm = totalStars / Math.max(1, effMaxS);
  const rNorm = Math.min(publicRepos / 200, 1);

  // Power curves — exponent < 1 compresses, > 0.5 gives more contrast than sqrt
  const cScore = Math.pow(Math.min(cNorm, 3), 0.55); // contributions (allow up to 3x max)
  const sScore = Math.pow(Math.min(sNorm, 3), 0.45); // stars (more generous curve)
  const rScore = Math.pow(rNorm, 0.5); // repos

  // Weights: contributions dominate, but stars matter a lot
  const composite = cScore * 0.55 + sScore * 0.35 + rScore * 0.1;

  const height = Math.min(
    MAX_BUILDING_HEIGHT,
    MIN_BUILDING_HEIGHT + composite * HEIGHT_RANGE,
  );
  return { height, composite };
}

// ─── V2 Detection & Formulas ────────────────────────────────

function isV2Dev(dev: DeveloperRecord): boolean {
  return (dev.contributions_total ?? 0) > 0;
}

function calcHeightV2(
  dev: DeveloperRecord,
  maxContribV2: number,
  maxStars: number,
): { height: number; composite: number } {
  const contribs =
    dev.contributions_total! > 0 ? dev.contributions_total! : dev.contributions;

  const cNorm = contribs / Math.max(1, Math.min(maxContribV2, 50_000));
  const sNorm = dev.total_stars / Math.max(1, Math.min(maxStars, 200_000));
  const prNorm = ((dev.total_prs ?? 0) + (dev.total_reviews ?? 0)) / 5_000;
  const extNorm = (dev.repos_contributed_to ?? 0) / 100;
  const fNorm =
    Math.log10(Math.max(1, dev.followers ?? 0)) / Math.log10(50_000);

  // Consistency: years active / account age
  const accountAgeYears = Math.max(
    1,
    (Date.now() -
      new Date(dev.account_created_at || dev.created_at).getTime()) /
      (365.25 * 24 * 60 * 60 * 1000),
  );
  const yearsActive = dev.contribution_years?.length || 1;
  const consistencyRaw =
    (yearsActive / accountAgeYears) *
    Math.min(1, contribs / (accountAgeYears * 200));
  const consistencyNorm = Math.min(1, consistencyRaw);

  const cScore = Math.pow(Math.min(cNorm, 3), 0.55);
  const sScore = Math.pow(Math.min(sNorm, 3), 0.45);
  const prScore = Math.pow(Math.min(prNorm, 2), 0.5);
  const extScore = Math.pow(Math.min(extNorm, 2), 0.5);
  const fScore = Math.pow(Math.min(fNorm, 2), 0.5);
  const cnsScore = Math.pow(consistencyNorm, 0.6);

  const composite =
    cScore * 0.35 +
    sScore * 0.2 +
    prScore * 0.15 +
    extScore * 0.1 +
    cnsScore * 0.1 +
    fScore * 0.1;

  const height = Math.min(
    MAX_BUILDING_HEIGHT,
    MIN_BUILDING_HEIGHT + composite * HEIGHT_RANGE,
  );
  return { height, composite };
}

function calcWidthV2(dev: DeveloperRecord): number {
  const repoNorm = Math.min(1, dev.public_repos / 200);
  const langNorm = Math.min(1, (dev.language_diversity ?? 1) / 10);
  const topStarNorm = Math.min(1, (dev.top_repos?.[0]?.stars ?? 0) / 50_000);

  const score =
    Math.pow(repoNorm, 0.5) * 0.5 +
    Math.pow(langNorm, 0.6) * 0.3 +
    Math.pow(topStarNorm, 0.4) * 0.2;

  const jitter = (seededRandom(hashStr(dev.github_login)) - 0.5) * 4;
  return Math.round(14 + score * 24 + jitter);
}

function calcDepthV2(dev: DeveloperRecord): number {
  const extNorm = Math.min(1, (dev.repos_contributed_to ?? 0) / 100);
  const orgNorm = Math.min(1, (dev.organizations_count ?? 0) / 10);
  const prNorm = Math.min(1, (dev.total_prs ?? 0) / 1_000);
  const ratioNorm =
    (dev.followers ?? 0) > 0
      ? Math.min(1, (dev.followers ?? 0) / Math.max(1, dev.following ?? 1) / 10)
      : 0;

  const score =
    Math.pow(extNorm, 0.5) * 0.4 +
    Math.pow(orgNorm, 0.5) * 0.25 +
    Math.pow(prNorm, 0.5) * 0.2 +
    Math.pow(ratioNorm, 0.5) * 0.15;

  const jitter = (seededRandom(hashStr(dev.github_login) + 99) - 0.5) * 4;
  return Math.round(12 + score * 20 + jitter);
}

function calcLitPercentageV2(dev: DeveloperRecord): number {
  const activeDaysNorm = Math.min(1, (dev.active_days_last_year ?? 0) / 300);
  const streakNorm = Math.min(1, (dev.current_streak ?? 0) / 100);

  const avgPerYear =
    (dev.contributions_total ?? 0) /
    Math.max(1, dev.contribution_years?.length ?? 1);
  const trendRaw = avgPerYear > 0 ? dev.contributions / avgPerYear : 1;
  const trendNorm = Math.min(2, Math.max(0, trendRaw)) / 2;

  const score = activeDaysNorm * 0.6 + streakNorm * 0.25 + trendNorm * 0.15;

  return 0.05 + score * 0.9;
}

export interface CityRiver {
  x: number;
  width: number;
  length: number;
  centerZ: number;
}

export interface CityBridge {
  position: [number, number, number];
  width: number;
  rotation: number; // radians around Y axis
}

export interface DistrictZone {
  id: string;
  name: string;
  center: [number, number, number];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  population: number;
  color: string;
}

/** Dois retângulos (bounds) se sobrepõem se há interseção em X e em Z. */
export function districtBoundsOverlap(
  a: { minX: number; maxX: number; minZ: number; maxZ: number },
  b: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ
  );
}

/** Retorna pares (idA, idB) de distritos cujas áreas se sobrepõem. Com partição Voronoi no layout, não deve haver sobreposição. */
export function findOverlappingDistrictZones(
  zones: DistrictZone[],
): { idA: string; idB: string }[] {
  const pairs: { idA: string; idB: string }[] = [];
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      if (districtBoundsOverlap(zones[i].bounds, zones[j].bounds)) {
        pairs.push({ idA: zones[i].id, idB: zones[j].id });
      }
    }
  }
  return pairs;
}

const RIVER_WIDTH = 40;

// ─── Manual Buildings ────────────────────────────────────────
// Add entries here to place custom buildings in the city that
// are not tied to any GitHub developer record.
//
// Required: login, position, width, depth, height
// Everything else has sensible defaults.

export interface ManualBuildingConfig {
  login: string;
  name?: string;
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  district?: string;
  primary_language?: string | null;
  litPercentage?: number;
  custom_color?: string | null;
  owned_items?: string[];
  billboard_images?: string[];
}

function generateCenterBuildings(): ManualBuildingConfig[] {
  const result: ManualBuildingConfig[] = [];
  const CLUSTER_RADIUS = 650;

  const districts: { id: string; height: number; width: number }[] = [
    { id: "empreender", height: 700, width: 250 },
    { id: "nuvemshop", height: 600, width: 150 },
    { id: "googleanalytics4", height: 600, width: 150 },
    { id: "meta", height: 600, width: 150 },
    { id: "yampi", height: 600, width: 150 },
    { id: "lojaintegrada", height: 600, width: 150 },
    { id: "tiktokshop", height: 600, width: 150 },
    { id: "tray", height: 600, width: 150 },
    { id: "shopify", height: 600, width: 150 },
    { id: "bling", height: 600, width: 150 },
    { id: "kiwify", height: 600, width: 150 },
    { id: "montink", height: 600, width: 150 },
  ];

  let outerIdx = 0;
  const outerCount = districts.length - 1;

  for (let i = 0; i < districts.length; i++) {
    const d = districts[i];
    let cx: number, cz: number;
    if (d.id === "empreender") {
      cx = 0;
      cz = 0;
    } else {
      const angle = (outerIdx / outerCount) * Math.PI * 2 - Math.PI / 2;
      cx = Math.round(CLUSTER_RADIUS * Math.cos(angle));
      cz = Math.round(CLUSTER_RADIUS * Math.sin(angle));
      outerIdx++;
    }

    result.push({
      login: `tower-${i + 1}`,
      name: `Torre ${d.id.replace("_", " ")}`,
      position: [cx, 0, cz],
      width: d.width,
      depth: Math.round(d.width * 0.7),
      height: d.height,
      district: d.id,
      custom_color: DISTRICT_COLORS[d.id] ?? null,
      litPercentage: 0.6,
    });
  }
  return result;
}

function precomputeComposites(
  devs: DeveloperRecord[],
  maxContrib: number,
  maxStars: number,
  maxContribV2: number,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const dev of devs) {
    const { composite } = isV2Dev(dev)
      ? calcHeightV2(dev, maxContribV2, maxStars)
      : calcHeight(
          dev.contributions,
          dev.total_stars,
          dev.public_repos,
          maxContrib,
          maxStars,
        );
    map.set(dev.github_login, composite);
  }
  return map;
}

// ─── District Layout ────────────────────────────────────────

export const DISTRICT_NAMES: Record<string, string> = {
  empreender: "Empreender",
  nuvemshop: "Nuvemshop",
  googleanalytics4: "Google Analytics",
  meta: "Meta",
  yampi: "Yampi",
  lojaintegrada: "Loja Integrada",
  tiktokshop: "TikTok Shop",
  tray: "Tray",
  shopify: "Shopify",
  bling: "Bling",
  kiwify: "Kiwify",
  montink: "Montink",
};

export const DISTRICT_COLORS: Record<string, string> = {
  shopify: "#95bf47",
  yampi: "#ab62ef",
  nuvemshop: "#0855c5",
  kiwify: "#09b36e",
  tray: "#141057",
  googleanalytics4: "#f27e0a",
  meta: "#0a69d4",
  empreender: "#a16bf9",
  montink: "#f70293",
  bling: "#3aaf67",
  tiktokshop: "#ff3156",
  lojaintegrada: "#32c6c5",
};

export const MANUAL_BUILDINGS: ManualBuildingConfig[] =
  generateCenterBuildings();

export const DISTRICT_DESCRIPTIONS: Record<string, string> = {
  empreender:
    "Somos parceiros de mais de 30 plataformas. Nossos apps estão disponíveis na Shopify, Nuvemshop, Yampi, Tray, Loja Integrada e muito mais!",
  nuvemshop:
    "Plataforma líder de e-commerce na América Latina. Crie e gerencie sua loja virtual com facilidade.",
  googleanalytics4:
    "Monitore o desempenho do seu site com análises detalhadas de tráfego, conversões e comportamento dos usuários.",
  meta: "Gerencie e otimize campanhas publicitárias no Facebook e Instagram para alcançar seu público-alvo.",
  yampi:
    "Checkout transparente e gestão completa de pedidos para maximizar suas conversões.",
  lojaintegrada:
    "Plataforma brasileira de e-commerce gratuita para criar, personalizar e gerenciar sua loja online.",
  tiktokshop:
    "Venda seus produtos diretamente no TikTok e alcance milhões de usuários pelo social commerce.",
  tray: "Solução completa de e-commerce com gestão integrada de produtos, pedidos, frete e pagamentos.",
  shopify:
    "A maior plataforma global de e-commerce para montar sua loja online com ferramentas profissionais.",
  bling:
    "Sistema de gestão empresarial (ERP) para automatizar estoque, notas fiscais e controle financeiro.",
  kiwify:
    "Plataforma completa para vender infoprodutos, cursos online e gerenciar programas de afiliados.",
  montink:
    "Somos uma plataforma de Print On Demand, onde pessoas ou empresas conseguem ter seus produtos personalizados com suas estampas, vender e lucrar muito.",
};

export const DISTRICT_URLS: Record<string, string> = {
  empreender: "https://empreender.com.br",
  nuvemshop: "https://www.nuvemshop.com.br",
  googleanalytics4: "https://analytics.google.com",
  meta: "https://www.facebook.com/business/ads",
  yampi: "https://www.yampi.com.br",
  lojaintegrada: "https://lojaintegrada.com.br",
  tiktokshop: "https://shop.tiktok.com",
  tray: "https://www.tray.com.br",
  shopify: "https://www.shopify.com.br",
  bling: "https://www.bling.com.br",
  kiwify: "https://kiwify.com.br",
  montink: "https://www.montink.com",
};

// const LANGUAGE_TO_DISTRICT: Record<string, string> = {
//   TypeScript: "nuvemshop",
//   JavaScript: "nuvemshop",
//   CSS: "nuvemshop",
//   HTML: "nuvemshop",
//   SCSS: "nuvemshop",
//   Vue: "nuvemshop",
//   Svelte: "nuvemshop",
//   Java: "googleanalytics4",
//   Go: "googleanalytics4",
//   Rust: "googleanalytics4",
//   "C#": "googleanalytics4",
//   PHP: "googleanalytics4",
//   Ruby: "googleanalytics4",
//   Elixir: "googleanalytics4",
//   C: "googleanalytics4",
//   "C++": "googleanalytics4",
//   Assembly: "googleanalytics4",
//   Verilog: "googleanalytics4",
//   VHDL: "googleanalytics4",
//   Python: "lojaintegrada",
//   "Jupyter Notebook": "lojaintegrada",
//   R: "lojaintegrada",
//   Julia: "lojaintegrada",
//   Swift: "yampi",
//   Kotlin: "yampi",
//   Dart: "yampi",
//   "Objective-C": "yampi",
//   HCL: "tiktokshop",
//   Shell: "tiktokshop",
//   Dockerfile: "tiktokshop",
//   Nix: "tiktokshop",
//   GDScript: "shopify",
//   Lua: "shopify",
// };

// export function inferDistrict(lang: string | null): string {
//   if (!lang) return "meta";
//   return LANGUAGE_TO_DISTRICT[lang] ?? "meta";
// }

function localBlockAxisPos(idx: number, footprint: number): number {
  if (idx === 0) return 0;
  const abs = Math.abs(idx);
  const sign = idx >= 0 ? 1 : -1;
  return sign * (abs * footprint + abs * STREET_W);
}

export function generateCityLayout(devs: DeveloperRecord[]): {
  buildings: CityBuilding[];
  plazas: CityPlaza[];
  decorations: CityDecoration[];
  river: CityRiver;
  bridges: CityBridge[];
  districtZones: DistrictZone[];
} {
  const buildings: CityBuilding[] = [];
  const plazas: CityPlaza[] = [];
  const decorations: CityDecoration[] = [];
  const districtZones: DistrictZone[] = [];
  const maxContrib = devs.reduce((max, d) => Math.max(max, d.contributions), 1);
  const maxStars = devs.reduce((max, d) => Math.max(max, d.total_stars), 1);
  const maxContribV2 = devs.reduce(
    (max, d) => Math.max(max, d.contributions_total ?? 0),
    1,
  );

  // ── 1. Group by district, sort within each, concat in priority order ──
  // const composites = precomputeComposites(
  //   devs,
  //   maxContrib,
  //   maxStars,
  //   maxContribV2,
  // );

  const DISTRICT_ORDER = [
    "googleanalytics4",
    "nuvemshop",
    "meta",
    "lojaintegrada",
    "tiktokshop",
    "yampi",
    "shopify",
    "bling",
    "kiwify",
    "montink",
    "tray",
  ];

  const districtGroups: Record<string, DeveloperRecord[]> = {};

  for (const dev of devs) {
    const did = dev.district;

    if (!did) continue;

    if (!districtGroups[did]) districtGroups[did] = [];
    districtGroups[did].push(dev);
  }

  // Seeded shuffle for deterministic "random" order
  function seededShuffle<T>(arr: T[], seed: number): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(seed + i * 7919) * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  const LOTS_PER_BLOCK = BLOCK_SIZE * BLOCK_SIZE; // 16

  // ── Per-district dev arrays (todos os devs ficam no seu distrito; shuffle para variedade visual) ──
  const districtDevArrays: { did: string; devs: DeveloperRecord[] }[] = [];
  for (const did of DISTRICT_ORDER) {
    const group = districtGroups[did];
    if (!group || group.length === 0) continue;
    districtDevArrays.push({
      did,
      devs: seededShuffle(group, hashStr(did)),
    });
  }
  for (const [did, group] of Object.entries(districtGroups)) {
    if (!DISTRICT_ORDER.includes(did)) {
      if (!group || group.length === 0) continue;
      districtDevArrays.push({
        did,
        devs: seededShuffle(group, hashStr(did)),
      });
    }
  }

  // Distritos que têm manual building (publicidade) mas sem devs: entram na lista para ter centro (ogx, ogz) e colocar o manual no meio.
  const didsInDistrictArrays = new Set(districtDevArrays.map((d) => d.did));
  for (const mb of MANUAL_BUILDINGS) {
    const did = mb.district ?? "empreender";

    if (did === "empreender") continue;

    if (!didsInDistrictArrays.has(did)) {
      didsInDistrictArrays.add(did);
      districtDevArrays.push({ did, devs: [] });
    }
  }

  // ── 2. Place blocks on a GLOBAL axis-aligned grid ──
  // Downtown spiral at center, each district spiral at an offset.
  // occupiedCells prevents any overlap.
  const BLOCK_STEP_X = BLOCK_FOOTPRINT_X + STREET_W; // 173
  const BLOCK_STEP_Z = BLOCK_FOOTPRINT_Z + STREET_W; // 149
  const RIVER_Z_THRESHOLD = BLOCK_STEP_Z / 2;
  const RIVER_PUSH = RIVER_WIDTH + 2 * RIVER_MARGIN - STREET_W;

  // Empreender: disco exclusivo no centro (0,0). Nenhum outro distrito pode colocar aqui; empreender é ignorado no Voronoi (só usa esse disco).
  const CENTER_EXCLUSIVE_RADIUS = 4;
  // Distritos externos: origens em círculo 3x mais afastado (formato circular mantido)
  const OUTER_DISTRICT_RADIUS = 4 * 2; // 12 células do centro

  // Origens: empreender em (0,0); demais em círculo de raio OUTER_DISTRICT_RADIUS. Voronoi ponderado só entre os externos.
  type OriginWithWeight = { ogx: number; ogz: number; weight: number };
  const districtOrigins: OriginWithWeight[] = [{ ogx: 0, ogz: 0, weight: 1 }];
  for (let di = 0; di < districtDevArrays.length; di++) {
    const angle = (di / districtDevArrays.length) * Math.PI * 2 - Math.PI / 2;
    const devCount = districtDevArrays[di].devs.length;
    districtOrigins.push({
      ogx: Math.round(Math.cos(angle) * OUTER_DISTRICT_RADIUS),
      ogz: Math.round(Math.sin(angle) * OUTER_DISTRICT_RADIUS),
      weight: Math.max(0.5, Math.sqrt(devCount) * 0.4),
    });
  }

  /** True se a célula (gx, gz) pertence ao território da origem no índice thisOriginIdx.
   * Empreender (índice 0): apenas células dentro do disco exclusivo; ignorado no Voronoi.
   * Outros distritos: nunca entram no disco do centro; fora dele, Voronoi ponderado entre si. */
  function cellBelongsToOrigin(
    gx: number,
    gz: number,
    thisOriginIdx: number,
    origins: OriginWithWeight[],
  ): boolean {
    const dist2ToCenter = gx * gx + gz * gz;
    const centerRadius2 = CENTER_EXCLUSIVE_RADIUS * CENTER_EXCLUSIVE_RADIUS;

    if (thisOriginIdx === 0) {
      // Empreender: só o disco exclusivo; não compete fora
      return dist2ToCenter < centerRadius2;
    }
    // Distrito externo: não pode entrar no disco do centro
    if (dist2ToCenter < centerRadius2) return false;

    const oThis = origins[thisOriginIdx];
    const dist2This = (gx - oThis.ogx) ** 2 + (gz - oThis.ogz) ** 2;
    const scoreThis = dist2This / (oThis.weight * oThis.weight);
    for (let i = 1; i < origins.length; i++) {
      if (i === thisOriginIdx) continue;
      const o = origins[i];
      const d2 = (gx - o.ogx) ** 2 + (gz - o.ogz) ** 2;
      const score = d2 / (o.weight * o.weight);
      if (score < scoreThis) return false;
    }
    return true;
  }

  const occupiedCells = new Set<string>();
  let globalDevIndex = 0;
  let globalBlockSeed = 0;
  const allBlocks: { cx: number; cz: number; gx: number; gz: number }[] = [];

  // ── Helper: grid coord → world position ──
  function gridToWorld(gx: number, gz: number): [number, number] {
    return [
      localBlockAxisPos(gx, BLOCK_FOOTPRINT_X),
      localBlockAxisPos(gz, BLOCK_FOOTPRINT_Z),
    ];
  }

  function getManualBuildingForDistrict(
    did: string,
  ): ManualBuildingConfig | undefined {
    return MANUAL_BUILDINGS.find((mb) => (mb.district ?? "empreender") === did);
  }

  /** Coloca o manual building no centro do distrito (célula ogx,ogz) e marca a célula como ocupada para o spiral não colocar devs em cima. */
  function placeManualBuildingAtGrid(
    ogx: number,
    ogz: number,
    mb: ManualBuildingConfig,
  ): void {
    const key = `${ogx},${ogz}`;
    occupiedCells.add(key);
    let [cx, cz] = gridToWorld(ogx, ogz);
    if (cz > RIVER_Z_THRESHOLD) cz += RIVER_PUSH;
    allBlocks.push({ cx, cz, gx: ogx, gz: ogz });
    const floorH = 6;
    const floors = Math.max(3, Math.floor(mb.height / floorH));
    const windowsPerFloor = Math.max(3, Math.floor(mb.width / 5));
    const sideWindowsPerFloor = Math.max(3, Math.floor(mb.depth / 5));
    buildings.push({
      login: mb.login,
      rank: 0,
      contributions: 0,
      total_stars: 0,
      public_repos: 0,
      name: mb.name ?? mb.login,
      avatar_url: null,
      primary_language: mb.primary_language ?? null,
      claimed: false,
      owned_items: mb.owned_items ?? [],
      custom_color:
        mb.custom_color ?? DISTRICT_COLORS[mb.district ?? "empreender"] ?? null,
      billboard_images: mb.billboard_images ?? [],
      achievements: [],
      kudos_count: 0,
      visit_count: 0,
      loadout: null,
      app_streak: 0,
      raid_xp: 0,
      current_week_contributions: 0,
      current_week_kudos_given: 0,
      current_week_kudos_received: 0,
      active_raid_tag: null,
      rabbit_completed: false,
      xp_total: 0,
      xp_level: 1,
      district: mb.district ?? "empreender",
      store_domain: null,
      position: [cx, 0, cz],
      width: mb.width,
      depth: mb.depth,
      height: mb.height,
      floors,
      windowsPerFloor,
      sideWindowsPerFloor,
      litPercentage: mb.litPercentage ?? 0.5,
    });
  }

  // ── Helper: create buildings + decorations for one block ──
  function placeBlockContent(
    blockCX: number,
    blockCZ: number,
    blockDevs: DeveloperRecord[],
    seedIdx: number,
  ) {
    for (let i = 0; i < blockDevs.length; i++) {
      const dev = blockDevs[i];
      const localRow = Math.floor(i / BLOCK_SIZE);
      const localCol = i % BLOCK_SIZE;
      const posX =
        blockCX + (localCol - (BLOCK_SIZE - 1) / 2) * (LOT_W + ALLEY_W);
      const posZ =
        blockCZ + (localRow - (BLOCK_SIZE - 1) / 2) * (LOT_D + ALLEY_W);

      let height: number,
        composite: number,
        w: number,
        d: number,
        litPercentage: number;

      if (isV2Dev(dev)) {
        ({ height, composite } = calcHeightV2(dev, maxContribV2, maxStars));
        w = calcWidthV2(dev);
        d = calcDepthV2(dev);
        litPercentage = calcLitPercentageV2(dev);
      } else {
        ({ height, composite } = calcHeight(
          dev.contributions,
          dev.total_stars,
          dev.public_repos,
          maxContrib,
          maxStars,
        ));
        const seed1 = hashStr(dev.github_login);
        const repoFactor = Math.min(1, dev.public_repos / 100);
        const baseW = 14 + repoFactor * 12;
        w = Math.round(baseW + seededRandom(seed1) * 8);
        d = Math.round(12 + seededRandom(seed1 + 99) * 16);
        litPercentage = 0.2 + composite * 0.7;
      }

      const floorH = 6;
      const floors = Math.max(3, Math.floor(height / floorH));
      const windowsPerFloor = Math.max(3, Math.floor(w / 5));
      const sideWindowsPerFloor = Math.max(3, Math.floor(d / 5));
      const did = dev.district;

      buildings.push({
        login: dev.github_login,
        rank: dev.rank ?? globalDevIndex + i + 1,
        contributions:
          dev.contributions_total && dev.contributions_total > 0
            ? dev.contributions_total
            : dev.contributions,
        total_stars: dev.total_stars,
        public_repos: dev.public_repos,
        name: dev.name,
        avatar_url: dev.avatar_url,
        primary_language: dev.primary_language,
        claimed: dev.claimed ?? false,
        owned_items: dev.owned_items ?? [],
        custom_color:
          dev.custom_color ?? DISTRICT_COLORS[did ?? "meta"] ?? null,
        billboard_images: dev.billboard_images ?? [],
        achievements:
          ((dev as unknown as Record<string, unknown>)
            .achievements as string[]) ?? [],
        kudos_count:
          ((dev as unknown as Record<string, unknown>).kudos_count as number) ??
          0,
        visit_count:
          ((dev as unknown as Record<string, unknown>).visit_count as number) ??
          0,
        loadout:
          ((dev as unknown as Record<string, unknown>)
            .loadout as CityBuilding["loadout"]) ?? null,
        app_streak:
          ((dev as unknown as Record<string, unknown>).app_streak as number) ??
          0,
        raid_xp:
          ((dev as unknown as Record<string, unknown>).raid_xp as number) ?? 0,
        current_week_contributions:
          ((dev as unknown as Record<string, unknown>)
            .current_week_contributions as number) ?? 0,
        current_week_kudos_given:
          ((dev as unknown as Record<string, unknown>)
            .current_week_kudos_given as number) ?? 0,
        current_week_kudos_received:
          ((dev as unknown as Record<string, unknown>)
            .current_week_kudos_received as number) ?? 0,
        active_raid_tag:
          ((dev as unknown as Record<string, unknown>)
            .active_raid_tag as CityBuilding["active_raid_tag"]) ?? null,
        rabbit_completed:
          ((dev as unknown as Record<string, unknown>)
            .rabbit_completed as boolean) ?? false,
        xp_total:
          ((dev as unknown as Record<string, unknown>).xp_total as number) ?? 0,
        xp_level:
          ((dev as unknown as Record<string, unknown>).xp_level as number) ?? 1,
        district: did ?? undefined,
        district_chosen:
          ((dev as unknown as Record<string, unknown>)
            .district_chosen as boolean) ?? false,
        store_domain: ((): string | null => {
          const v = (dev as unknown as Record<string, unknown>).store_domain;
          return typeof v === "string" && v.trim() ? v.trim() : null;
        })(),
        position: [posX, 0, posZ],
        width: w,
        depth: d,
        height,
        floors,
        windowsPerFloor,
        sideWindowsPerFloor,
        litPercentage,
      });
    }

    decorations.push({
      type: "sidewalk",
      position: [blockCX, 0.1, blockCZ],
      rotation: 0,
      variant: 0,
      size: [BLOCK_FOOTPRINT_X + 8, BLOCK_FOOTPRINT_Z + 8],
    });

    const lampSeed = seedIdx * 1000 + 31;
    const lampCount = 2 + Math.floor(seededRandom(lampSeed * 311) * 3);
    for (let li = 0; li < lampCount; li++) {
      const seed = lampSeed * 5000 + li;
      const edge = Math.floor(seededRandom(seed) * 4);
      const alongX = (seededRandom(seed + 50) - 0.5) * BLOCK_FOOTPRINT_X;
      const alongZ = (seededRandom(seed + 50) - 0.5) * BLOCK_FOOTPRINT_Z;
      let lx = blockCX,
        lz = blockCZ;
      if (edge === 0) {
        lz -= BLOCK_FOOTPRINT_Z / 2 + 4;
        lx += alongX;
      } else if (edge === 1) {
        lx += BLOCK_FOOTPRINT_X / 2 + 4;
        lz += alongZ;
      } else if (edge === 2) {
        lz += BLOCK_FOOTPRINT_Z / 2 + 4;
        lx += alongX;
      } else {
        lx -= BLOCK_FOOTPRINT_X / 2 + 4;
        lz += alongZ;
      }
      decorations.push({
        type: "streetLamp",
        position: [lx, 0, lz],
        rotation: 0,
        variant: 0,
      });
    }

    for (let bi = 0; bi < blockDevs.length; bi++) {
      const bld = buildings[buildings.length - blockDevs.length + bi];
      const carSeed = hashStr(blockDevs[bi].github_login) + 777;
      if (seededRandom(carSeed) > 0.6) {
        const side = seededRandom(carSeed + 1) > 0.5 ? 1 : -1;
        const carX = bld.position[0] + side * (bld.width / 2 + 6);
        decorations.push({
          type: "car",
          position: [carX, 0, bld.position[2]],
          rotation: seededRandom(carSeed + 2) > 0.5 ? 0 : Math.PI,
          variant: Math.floor(seededRandom(carSeed + 3) * 4),
        });
      }
    }

    const treeSeed = seedIdx * 2000 + 77;
    const treeCount = 1 + Math.floor(seededRandom(treeSeed * 421) * 2);
    for (let ti = 0; ti < treeCount; ti++) {
      const seed = treeSeed * 6000 + ti;
      const edge = Math.floor(seededRandom(seed) * 4);
      const alongX = (seededRandom(seed + 50) - 0.5) * BLOCK_FOOTPRINT_X * 0.8;
      const alongZ = (seededRandom(seed + 50) - 0.5) * BLOCK_FOOTPRINT_Z * 0.8;
      let tx = blockCX,
        tz = blockCZ;
      if (edge === 0) {
        tz -= BLOCK_FOOTPRINT_Z / 2 + 6;
        tx += alongX;
      } else if (edge === 1) {
        tx += BLOCK_FOOTPRINT_X / 2 + 6;
        tz += alongZ;
      } else if (edge === 2) {
        tz += BLOCK_FOOTPRINT_Z / 2 + 6;
        tx += alongX;
      } else {
        tx -= BLOCK_FOOTPRINT_X / 2 + 6;
        tz += alongZ;
      }
      decorations.push({
        type: "tree",
        position: [tx, 0, tz],
        rotation: seededRandom(seed + 100) * Math.PI * 2,
        variant: Math.floor(seededRandom(seed + 200) * 3),
      });
    }

    globalDevIndex += blockDevs.length;
  }

  // ── Helper: place a spiral of devs at grid origin (ogx, ogz). Só usa células do território Voronoi do distrito para evitar sobreposição. ──
  function placeSpiralCluster(
    clusterDevs: DeveloperRecord[],
    ogx: number,
    ogz: number,
    addPlaza: boolean,
    origins: OriginWithWeight[],
    originIndex: number,
  ) {
    // Plaza at origin cell (só se a origem pertencer a este distrito)
    if (addPlaza && cellBelongsToOrigin(ogx, ogz, originIndex, origins)) {
      const key = `${ogx},${ogz}`;
      occupiedCells.add(key);
      let [pcx, pcz] = gridToWorld(ogx, ogz);
      if (pcz > RIVER_Z_THRESHOLD) pcz += RIVER_PUSH;
      plazas.push({
        position: [pcx, 0, pcz],
        size: Math.min(BLOCK_FOOTPRINT_X, BLOCK_FOOTPRINT_Z) * 0.8,
        variant: seededRandom(globalBlockSeed * 997 + 42),
      });
      allBlocks.push({ cx: pcx, cz: pcz, gx: ogx, gz: ogz });
      globalBlockSeed++;
    }

    let devIdx = 0;
    let spiralIdx = 0;

    while (devIdx < clusterDevs.length) {
      const [bx, by] = spiralCoord(spiralIdx);
      const gx = ogx + bx;
      const gz = ogz + by;
      const key = `${gx},${gz}`;

      if (occupiedCells.has(key)) {
        spiralIdx++;
        continue;
      }
      // Só coloca bloco se a célula pertencer ao território deste distrito (Voronoi)
      if (!cellBelongsToOrigin(gx, gz, originIndex, origins)) {
        spiralIdx++;
        continue;
      }
      occupiedCells.add(key);

      let [blockCX, blockCZ] = gridToWorld(gx, gz);
      if (blockCZ > RIVER_Z_THRESHOLD) blockCZ += RIVER_PUSH;

      const jitterSeed = globalBlockSeed * 10000;
      blockCX += (seededRandom(jitterSeed) - 0.5) * 6;
      blockCZ += (seededRandom(jitterSeed + 7777) - 0.5) * 6;

      const blockDevs = clusterDevs.slice(devIdx, devIdx + LOTS_PER_BLOCK);
      placeBlockContent(blockCX, blockCZ, blockDevs, globalBlockSeed);
      allBlocks.push({ cx: blockCX, cz: blockCZ, gx, gz });

      devIdx += blockDevs.length;
      spiralIdx++;
      globalBlockSeed++;
    }
  }

  // ── A) Distrito central empreender: apenas o prédio manual no centro (0,0). ──
  const manualEmpreender = getManualBuildingForDistrict("empreender");
  if (manualEmpreender) placeManualBuildingAtGrid(0, 0, manualEmpreender);

  // ── B) Districts: manual building no centro de cada distrito; devs do snapshot em volta. ──
  for (let di = 0; di < districtDevArrays.length; di++) {
    const angle = (di / districtDevArrays.length) * Math.PI * 2 - Math.PI / 2;
    const ogx = Math.round(Math.cos(angle) * OUTER_DISTRICT_RADIUS);
    const ogz = Math.round(Math.sin(angle) * OUTER_DISTRICT_RADIUS);
    const did = districtDevArrays[di].did;
    const manualDistrict = getManualBuildingForDistrict(did);
    if (manualDistrict) placeManualBuildingAtGrid(ogx, ogz, manualDistrict);
    placeSpiralCluster(
      districtDevArrays[di].devs,
      ogx,
      ogz,
      !manualDistrict,
      districtOrigins,
      di + 1,
    );
  }

  // ── Road markings between adjacent blocks (global grid) ──
  const DASH_LENGTH = 6;
  const DASH_GAP = 8;
  const DASH_STEP = DASH_LENGTH + DASH_GAP;
  const blockByGrid = new Map<string, (typeof allBlocks)[0]>();
  for (const b of allBlocks) blockByGrid.set(`${b.gx},${b.gz}`, b);
  for (const block of allBlocks) {
    const halfX = BLOCK_FOOTPRINT_X / 2;
    const halfZ = BLOCK_FOOTPRINT_Z / 2;
    const right = blockByGrid.get(`${block.gx + 1},${block.gz}`);
    if (right) {
      const roadCX = (block.cx + halfX + right.cx - halfX) / 2;
      const zMin = Math.min(block.cz, right.cz) - halfZ;
      const zMax = Math.max(block.cz, right.cz) + halfZ;
      for (let z = zMin; z <= zMax; z += DASH_STEP) {
        decorations.push({
          type: "roadMarking",
          position: [roadCX, 0.2, z],
          rotation: 0,
          variant: 0,
          size: [2, DASH_LENGTH],
        });
      }
    }
    const bottom = blockByGrid.get(`${block.gx},${block.gz + 1}`);
    if (bottom) {
      const roadCZ = (block.cz + halfZ + bottom.cz - halfZ) / 2;
      const xMin = Math.min(block.cx, bottom.cx) - halfX;
      const xMax = Math.max(block.cx, bottom.cx) + halfX;
      for (let x = xMin; x <= xMax; x += DASH_STEP) {
        decorations.push({
          type: "roadMarking",
          position: [x, 0.2, roadCZ],
          rotation: Math.PI / 2,
          variant: 0,
          size: [2, DASH_LENGTH],
        });
      }
    }
  }

  // ── Plaza decorations ──
  for (let pi = 0; pi < plazas.length; pi++) {
    const plaza = plazas[pi];
    const [px, , pz] = plaza.position;
    const halfSize = plaza.size / 2;
    const ptreeCount = 4 + Math.floor(seededRandom(pi * 137 + 7777) * 5);
    for (let t = 0; t < ptreeCount; t++) {
      const seed = pi * 10000 + t;
      decorations.push({
        type: "tree",
        position: [
          px + (seededRandom(seed) - 0.5) * halfSize * 1.6,
          0,
          pz + (seededRandom(seed + 50) - 0.5) * halfSize * 1.6,
        ],
        rotation: seededRandom(seed + 100) * Math.PI * 2,
        variant: Math.floor(seededRandom(seed + 200) * 3),
      });
    }
    const benchCount = 2 + Math.floor(seededRandom(pi * 251 + 8888) * 2);
    for (let b = 0; b < benchCount; b++) {
      const seed = pi * 20000 + b;
      decorations.push({
        type: "bench",
        position: [
          px + (seededRandom(seed) - 0.5) * halfSize,
          0,
          pz + (seededRandom(seed + 50) - 0.5) * halfSize,
        ],
        rotation: seededRandom(seed + 100) * Math.PI * 2,
        variant: 0,
      });
    }
    if (pi === 0) {
      decorations.push({
        type: "fountain",
        position: [px, 0, pz],
        rotation: 0,
        variant: 0,
      });
    }
  }

  // Manual buildings já foram colocados no centro de cada distrito (placeManualBuildingAtGrid) e a célula reservada para os devs ficarem em volta.

  // ── District zones (computed from actual building positions) ──
  const dzMap: Record<string, CityBuilding[]> = {};
  for (const b of buildings) {
    const did = b.district ?? "meta";
    if (!dzMap[did]) dzMap[did] = [];
    dzMap[did].push(b);
  }
  for (const [did, dBlds] of Object.entries(dzMap)) {
    let mnX = Infinity,
      mxX = -Infinity,
      mnZ = Infinity,
      mxZ = -Infinity;
    let sX = 0,
      sZ = 0;
    for (const b of dBlds) {
      mnX = Math.min(mnX, b.position[0]);
      mxX = Math.max(mxX, b.position[0]);
      mnZ = Math.min(mnZ, b.position[2]);
      mxZ = Math.max(mxZ, b.position[2]);
      sX += b.position[0];
      sZ += b.position[2];
    }
    districtZones.push({
      id: did,
      name: DISTRICT_NAMES[did] ?? did,
      center: [sX / dBlds.length, 0, sZ / dBlds.length],
      bounds: { minX: mnX, maxX: mxX, minZ: mnZ, maxZ: mxZ },
      population: dBlds.length,
      color: DISTRICT_COLORS[did] ?? "#888888",
    });
  }

  // ── River ──
  const riverCenterZ = RIVER_Z_THRESHOLD + RIVER_PUSH / 2 + STREET_W / 2;
  let bMinX = 0,
    bMaxX = 0;
  for (const b of buildings) {
    if (b.position[0] < bMinX) bMinX = b.position[0];
    if (b.position[0] > bMaxX) bMaxX = b.position[0];
  }
  const riverPadding = 80;
  const riverXExtent = bMaxX - bMinX + riverPadding * 2;
  const riverCenterX = (bMinX + bMaxX) / 2;
  const river: CityRiver = {
    x: riverCenterX - riverXExtent / 2,
    width: riverXExtent,
    length: RIVER_WIDTH,
    centerZ: riverCenterZ,
  };

  // ── Bridges ──
  const bridgeWidth = RIVER_WIDTH + 20;
  const bridgeSpacing = riverXExtent / 4;
  const bridges: CityBridge[] = [
    {
      position: [riverCenterX, 0, riverCenterZ],
      width: bridgeWidth,
      rotation: Math.PI / 2,
    },
    {
      position: [riverCenterX + bridgeSpacing, 0, riverCenterZ],
      width: bridgeWidth,
      rotation: Math.PI / 2,
    },
    {
      position: [riverCenterX - bridgeSpacing, 0, riverCenterZ],
      width: bridgeWidth,
      rotation: Math.PI / 2,
    },
  ];

  return { buildings, plazas, decorations, river, bridges, districtZones };
}

// ─── Building Dimensions (reusable for shop preview) ────────

export function calcBuildingDims(
  githubLogin: string,
  contributions: number,
  publicRepos: number,
  totalStars: number,
  maxContrib: number,
  maxStars: number,
  v2Data?: Partial<DeveloperRecord>,
): { width: number; height: number; depth: number } {
  // V2 path when expanded data is available
  if (v2Data && (v2Data.contributions_total ?? 0) > 0) {
    const dev: DeveloperRecord = {
      id: 0,
      github_login: githubLogin,
      github_id: null,
      name: null,
      avatar_url: null,
      bio: null,
      contributions,
      public_repos: publicRepos,
      total_stars: totalStars,
      primary_language: null,
      top_repos: [],
      rank: null,
      fetched_at: "",
      created_at: "",
      claimed: false,
      fetch_priority: 0,
      claimed_at: null,
      ...v2Data,
    };
    const { height } = calcHeightV2(dev, maxContrib, maxStars);
    return { width: calcWidthV2(dev), height, depth: calcDepthV2(dev) };
  }

  // V1 fallback
  const { height } = calcHeight(
    contributions,
    totalStars,
    publicRepos,
    maxContrib,
    maxStars,
  );
  const seed1 = hashStr(githubLogin);
  const repoFactor = Math.min(1, publicRepos / 100);
  const baseW = 14 + repoFactor * 16;
  const width = Math.round(baseW + seededRandom(seed1) * 10);
  const depth = Math.round(12 + seededRandom(seed1 + 99) * 20);
  return { width, height, depth };
}

// ─── Utilities (kept for Building3D seeded variance) ─────────

export function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function seededRandom(seed: number): number {
  const s = (seed * 16807) % 2147483647;
  return (s - 1) / 2147483646;
}
