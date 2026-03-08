/**
 * Centralized Dash API client.
 * Mock implementation; replace with real HTTP calls when Dash API is available.
 */

import { isValidIntegration, normalizedPlatform, normalizedStoreDomain, unnormalizedPlatform } from "@/lib/integrations";
import { getSupabaseAdmin } from "@/lib/supabase";

const DASH_API_URL = process.env.DASH_API_URL ?? "";
const DASH_API_TOKEN = process.env.DASH_API_TOKEN ?? "";
const MOCKUP_DASH_API = process.env.MOCKUP_DASH_API === "true" ? true : false;

export interface DashUser {
  id: number;
  name: string;
  email: string;
}

/**
 * GET /get-simple-user
 * Returns the current user from the Dash app. Auth: Authorization: Bearer <token>.
 */
export async function getDashUser(
  token: string
): Promise<DashUser | null> {

  if (MOCKUP_DASH_API) {
    return {
      id: 160,
      name: "Dev Teste",
      email: "felipe.epr.dev@gmail.com"
    };
  }

  if (!DASH_API_URL?.trim()) {
    // Mock when no URL configured (e.g. local dev)
    return null;
  }
  try {
    const res = await fetch(`${DASH_API_URL.replace(/\/$/, "")}/get-simple-user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (
      typeof data?.data?.id !== "number" ||
      typeof data?.data?.name !== "string" ||
      typeof data?.data?.email !== "string"
    ) {
      return null;
    }
    return {
      id: data.data.id,
      name: data.data.name,
      email: data.data.email
    };
  } catch {
    return null;
  }
}

export interface DashStore {
  platform: string;
  store_id: string;
  user_id: number;
  store_name: string;
  store_domain: string
}

export interface DashStoreInfo {
  platform: string;
  store_id: string;
  user_id: number;
  contributions: number;
  public_repos: number;
}

export interface SupabaseUserContext {
  id: string;
  email?: string;
}

/**
 * GET /empreendercity/user-stores/:user_id
 * Returns list of stores for the given Dash user.
 * Apenas lojas cuja plataforma está em integrações válidas do app são incluídas.
 */
export async function getUserStores(params: {
  dashUserId: number;
  supabaseUser?: SupabaseUserContext;
}): Promise<DashStore[]> {
  let stores: DashStore[];

  if (MOCKUP_DASH_API) {
    stores = [
      {
        platform: "Nuvemshop", // normalizando para o padrão que o sistema aceita
        store_id: "1373594",
        user_id: params.dashUserId,
        store_name: "Só Moda Top",
        store_domain: "somodatop.com.br",
      },
    ];
  } else {
    if (!DASH_API_URL?.trim() || !DASH_API_TOKEN?.trim()) {
      stores = [];
    } else {
      try {
        const res = await fetch(
          `${DASH_API_URL.replace(/\/$/, "")}/empreendercity/user-stores/${params.dashUserId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${DASH_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            cache: "no-store",
          }
        );
        if (!res.ok) {
          stores = [];
        } else {
          const json = await res.json();
          const raw = json?.data;
          if (!Array.isArray(raw)) {
            stores = [];
          } else {
            stores = raw
              .filter(
                (item: unknown) =>
                  item != null &&
                  typeof item === "object" &&
                  typeof (item as { platform?: unknown }).platform === "string" &&
                  typeof (item as { store_id?: unknown }).store_id === "string" &&
                  typeof (item as { user_id?: unknown }).user_id === "number" &&
                  typeof (item as { store_name?: unknown }).store_name === "string"
              )
              .map((item: { platform: string; store_id: string; user_id: number; store_name: string; store_domain?: string }) => ({
                platform: item.platform,
                store_id: item.store_id,
                user_id: item.user_id,
                store_name: item.store_name,
                store_domain: normalizedStoreDomain(item.store_domain ?? ""),
              }));
          }
        }
      } catch {
        stores = [];
      }
    }
  }

  const validStores: DashStore[] = [];

  stores.forEach((store) => {
    const normalizedPlatformName = normalizedPlatform(store.platform);

    if (isValidIntegration(normalizedPlatformName)) {
      store.platform = normalizedPlatformName;
      validStores.push(store);
    }
  });

  return validStores;
}

/**
 * POST /empreendercity/store-info
 * Body: { platform, store_id, user_id }
 * Returns store metrics (contributions, public_repos).
 */
export async function getStoreInfos(params: {
  platform: string;
  store_id: string;
  user_id: number;
}): Promise<DashStoreInfo | null> {

  if (MOCKUP_DASH_API) {
    return {
      platform: params.platform,
      store_id: params.store_id,
      user_id: params.user_id,
      contributions: 450,
      public_repos: 5000
    };
  }

  if (!DASH_API_URL?.trim() || !DASH_API_TOKEN?.trim()) {
    return null;
  }

  const unnormalizedPlatformName = unnormalizedPlatform(params.platform); // voltando para o padrão dentro do Dash para conseguir pesquisar

  try {
    const res = await fetch(`${DASH_API_URL.replace(/\/$/, "")}/empreendercity/store-info`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DASH_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform: unnormalizedPlatformName,
        store_id: params.store_id,
        user_id: params.user_id,
      }),
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));
    const code = json?.code;
    const message = json?.message;
    const data = json?.data;

    if (code === 200 && data != null && typeof data === "object") {
      const score1 = data.score_1;
      const score2 = data.score_2;
      return {
        platform: params.platform,
        store_id: params.store_id,
        user_id: params.user_id,
        contributions: typeof score1 === "number" ? Math.round(score1) : 0,
        public_repos: typeof score2 === "number" ? Math.round(score2) : 0,
      };
    }

    if (code === 400 && message === "integration_deleted") {
      const githubLogin = buildDashLogin(params.platform, params.store_id, params.user_id);
      const sb = getSupabaseAdmin();
      try {
        await sb.from("developers").update({ allow_data_for_buildings: false }).eq("github_login", githubLogin);
      } catch {
      }
      return null;
    }

    // 401 (Token inválido) ou outros erros: retorna null
    return null;
  } catch {
    return null;
  }
}

const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function encodeBase62Number(n: number): string {
  if (n < 0 || !Number.isInteger(n)) return "";
  if (n === 0) return BASE62_ALPHABET[0];
  let s = "";
  while (n > 0) {
    s = BASE62_ALPHABET[n % 62] + s;
    n = Math.floor(n / 62);
  }
  return s;
}

/** Encodes a string to base62 (UTF-8 bytes as big integer). */
function encodeBase62String(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let n = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    n = n * BigInt(256) + BigInt(bytes[i]);
  }
  if (n === BigInt(0)) return BASE62_ALPHABET[0];
  let s = "";
  while (n > BigInt(0)) {
    s = BASE62_ALPHABET[Number(n % BigInt(62))] + s;
    n = n / BigInt(62);
  }
  return s;
}

function decodeBase62Number(s: string): number | null {
  if (!s.length) return null;
  let n = 0;
  for (const c of s) {
    const i = BASE62_ALPHABET.indexOf(c);
    if (i === -1) return null;
    n = n * 62 + i;
  }
  return n;
}

/** Decodes a base62 string back to UTF-8 string. */
function decodeBase62String(encoded: string): string | null {
  if (!encoded.length) return "";
  let n = BigInt(0);
  for (const c of encoded) {
    const i = BASE62_ALPHABET.indexOf(c);
    if (i === -1) return null;
    n = n * BigInt(62) + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > BigInt(0)) {
    bytes.unshift(Number(n % BigInt(256)));
    n = n / BigInt(256);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/**
 * Build github_login for Dash stores: "platform_encodedStoreId_encodedUserId".
 * storeId (string) and userId (number) are encoded in base62 before concatenation.
 */
export function buildDashLogin(platform: string, storeId: string, userId: number): string {
  const encodedStoreId = encodeBase62String(storeId);
  const encodedUserId = encodeBase62Number(userId);
  return `${platform}_${encodedStoreId}_${encodedUserId}`;
}

/**
 * Parse github_login in format "platform_encodedStoreId_encodedUserId" for Dash stores.
 * Decodes store_id and user_id from base62.
 * Returns null if format doesn't match (e.g. GitHub login).
 */
export function parseDashLogin(githubLogin: string): {
  platform: string;
  store_id: string;
  user_id: number;
} | null {
  const parts = githubLogin.split("_");
  if (parts.length < 3) return null;
  const platform = parts[0];
  const decodedStore = decodeBase62String(parts[1]);
  const user_id = decodeBase62Number(parts[2]);
  if (decodedStore == null || user_id == null || Number.isNaN(user_id)) return null;
  return {
    platform,
    store_id: decodedStore,
    user_id,
  };
}
