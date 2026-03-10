import {
  DISTRICT_NAMES,
  DISTRICT_COLORS,
  DISTRICT_URLS,
  MANUAL_BUILDINGS,
} from "./github";

export type AdVehicle =
  | "plane"
  | "blimp"
  | "billboard"
  | "rooftop_sign"
  | "led_wrap";

export interface SkyAd {
  id: string;
  text: string;
  brand?: string;
  description?: string;
  color: string;
  bgColor: string;
  link?: string;
  vehicle: AdVehicle;
  priority: number;
  /** Optional building login to attach this ad to (e.g. "tower-2") */
  targetBuilding?: string;
}

export const MAX_PLANES = 8;
export const MAX_BLIMPS = 4;
export const MAX_BILLBOARDS = 15;
export const MAX_ROOFTOP_SIGNS = 10;
export const MAX_LED_WRAPS = 10;
export const MAX_TEXT_LENGTH = 150;

const ALLOWED_LINK_PATTERN = /^(https:\/\/|mailto:)/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function isBuildingAd(
  vehicle: string,
): vehicle is "billboard" | "rooftop_sign" | "led_wrap" {
  return (
    vehicle === "billboard" ||
    vehicle === "rooftop_sign" ||
    vehicle === "led_wrap"
  );
}

export function validateAds(ads: SkyAd[]): SkyAd[] {
  return ads
    .filter((ad) => {
      if (ad.text.length > MAX_TEXT_LENGTH) return false;
      if (ad.link && !ALLOWED_LINK_PATTERN.test(ad.link)) return false;
      if (!HEX_COLOR_PATTERN.test(ad.color)) return false;
      if (!HEX_COLOR_PATTERN.test(ad.bgColor)) return false;
      return true;
    })
    .sort((a, b) => b.priority - a.priority);
}

export function getActiveAds(ads: SkyAd[]) {
  const valid = validateAds(ads);
  return {
    planeAds: valid.filter((a) => a.vehicle === "plane").slice(0, MAX_PLANES),
    blimpAds: valid.filter((a) => a.vehicle === "blimp").slice(0, MAX_BLIMPS),
    billboardAds: valid
      .filter((a) => a.vehicle === "billboard")
      .slice(0, MAX_BILLBOARDS),
    rooftopSignAds: valid
      .filter((a) => a.vehicle === "rooftop_sign")
      .slice(0, MAX_ROOFTOP_SIGNS),
    ledWrapAds: valid
      .filter((a) => a.vehicle === "led_wrap")
      .slice(0, MAX_LED_WRAPS),
  };
}

/** Append UTM params to an ad link. Skips mailto: links. */
export function buildAdLink(ad: SkyAd): string | undefined {
  if (!ad.link) return undefined;
  if (ad.link.startsWith("mailto:")) return ad.link;
  try {
    const url = new URL(ad.link);
    url.searchParams.set("utm_source", "gitcity");
    url.searchParams.set("utm_medium", "sky_ad");
    url.searchParams.set("utm_campaign", ad.id);
    url.searchParams.set("utm_content", ad.vehicle);
    return url.toString();
  } catch {
    return ad.link;
  }
}

/** Fire a tracking beacon to the sky-ads track API (non-blocking). */
export function trackAdEvent(
  adId: string,
  eventType: "impression" | "click" | "cta_click",
  githubLogin?: string,
) {
  const body = JSON.stringify({
    ad_id: adId,
    event_type: eventType,
    ...(githubLogin && { github_login: githubLogin }),
  });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/sky-ads/track",
      new Blob([body], { type: "application/json" }),
    );
  } else {
    fetch("/api/sky-ads/track", {
      method: "POST",
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

/** Fire multiple event types in a single beacon (saves rate limit budget). */
export function trackAdEvents(
  adId: string,
  eventTypes: ("impression" | "click" | "cta_click")[],
  githubLogin?: string,
) {
  const body = JSON.stringify({
    ad_id: adId,
    event_types: eventTypes,
    ...(githubLogin && { github_login: githubLogin }),
  });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/sky-ads/track",
      new Blob([body], { type: "application/json" }),
    );
  } else {
    fetch("/api/sky-ads/track", {
      method: "POST",
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

// Darken a hex color for billboard backgrounds
function darkenHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 0.15;
  return `#${[r, g, b]
    .map((c) =>
      Math.round(c * f)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

// Derive from DISTRICT_URLS so billboards exist even if MANUAL_BUILDINGS shape changes.
// Attach to a building when we find one for that district.
export const DISTRICT_BILLBOARDS: SkyAd[] = Object.keys(DISTRICT_URLS).map((did, i) => {
  const name = DISTRICT_NAMES[did] ?? did;
  const color = DISTRICT_COLORS[did] ?? "#ffffff";
  const building = MANUAL_BUILDINGS.find((b) => (b.district ?? "") === did);
  return {
    id: `district-bb-${did}`,
    text: `★ ${name.toUpperCase()} ★`,
    brand: name,
    color,
    bgColor: darkenHex(color),
    link: DISTRICT_URLS[did],
    vehicle: "billboard" as const,
    priority: 50 - i,
    ...(building && { targetBuilding: building.login }),
  };
});

export const DEFAULT_SKY_ADS: SkyAd[] = [
  // ─── Building Ads ──────────────────────────────────────────
  // {
  //   id: "rooftop-1",
  //   text: "⚡ EMPREENDER ⚡",
  //   brand: "Empreender",
  //   color: "#ff6b35",
  //   bgColor: "#1a0e08",
  //   link: "https://app.empreender.com.br",
  //   vehicle: "rooftop_sign",
  //   priority: 80,
  //   targetBuilding: "tower-1",
  // },
  // ─── District tower billboards (auto-generated) ────────────
  ...DISTRICT_BILLBOARDS,
];
