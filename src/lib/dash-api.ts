/**
 * Centralized Dash API client.
 * Mock implementation; replace with real HTTP calls when Dash API is available.
 */

import { isValidIntegration, normalizedPlatform, unnormalizedPlatform } from "@/lib/integrations";

const DASH_API_URL = process.env.DASH_API_URL ?? "";
const MOCKUP_DASH_API = process.env.MOCKUP_DASH_API === "true" ? true : false;

export interface DashUser {
  id: number;
  name: string;
  email: string;
}

/**
 * GET /api/get-user
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
    const res = await fetch(`${DASH_API_URL.replace(/\/$/, "")}/api/get-user`, {
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
      typeof data?.id !== "number" ||
      typeof data?.name !== "string" ||
      typeof data?.email !== "string"
    ) {
      return null;
    }
    return {
      id: data.id,
      name: data.name,
      email: data.email
    };
  } catch {
    return null;
  }
}

export interface DashStore {
  platform: string;
  store_id: number;
  user_id: number;
  store_name: string;
}

export interface DashStoreInfo {
  platform: string;
  store_id: number;
  user_id: number;
  orders_count: number;
  store_revenue: number;
}

export interface SupabaseUserContext {
  id: string;
  email?: string;
}

/**
 * GET /api/getUserStores/:user_id
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
        store_id: 1373594,
        user_id: params.dashUserId,
        store_name: "Só Moda Top",
      },
    ];
  } else {
    // Implementar a chamada para a API do Dash
    stores = [];
  }

  const validStores: DashStore[] = [];

  stores.forEach((store) => {
    let normalizedPlatformName = normalizedPlatform(store.platform);

    if (isValidIntegration(normalizedPlatformName)) {
      store.platform = normalizedPlatformName;
      validStores.push(store);
    }
  });

  return validStores;
}

/**
 * POST /api/getStoreInfos
 * Body: { platform, store_id, user_id }
 * Returns store metrics (orders_count, store_revenue).
 */
export async function getStoreInfos(params: {
  platform: string;
  store_id: number;
  user_id: number;
}): Promise<DashStoreInfo | null> {

  if (MOCKUP_DASH_API) {
    return {
      platform: params.platform,
      store_id: params.store_id,
      user_id: params.user_id,
      orders_count: 450,
      store_revenue: 5000,
    };
  }

  //const unnormalizedPlatformName = unnormalizedPlatform(params.platform); // voltando para o padrão dentro do Dash para conseguir pesquisar

  // Implementar a chamada para a API
  return null;
}

/**
 * Parse github_login in format "platform_storeId_userId" for Dash stores.
 * Returns null if format doesn't match (e.g. GitHub login).
 */
export function parseDashLogin(githubLogin: string): {
  platform: string;
  store_id: number;
  user_id: number;
} | null {
  const parts = githubLogin.split("_");
  if (parts.length < 3) return null;
  const platform = parts[0];
  const storeId = parseInt(parts[1], 10);
  const userId = parseInt(parts[2], 10);
  if (Number.isNaN(storeId) || Number.isNaN(userId)) return null;
  return { platform, store_id: storeId, user_id: userId };
}
