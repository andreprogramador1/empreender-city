import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetch developer by github_login and ensure it is owned by the given auth user (claimed_by === userId).
 * Use when the API must act on behalf of the current user's store (developer = loja no Dash).
 *
 * Um usuário pode ter vários developers (várias lojas). O backend não escolhe qual loja usar:
 * o frontend envia sempre o github_login da loja em contexto (ex.: da URL /shop/[username]
 * ou do seletor de loja). GET /api/profile retorna `developers` (lista de lojas do usuário)
 * para o frontend montar o seletor e persistir a loja atual (ex.: localStorage).
 */
export async function getDeveloperOwnedByUser<T extends Record<string, unknown>>(
  sb: SupabaseClient,
  userId: string,
  githubLogin: string,
  select = "id, claimed, claimed_by"
): Promise<T | null> {
  if (!githubLogin || typeof githubLogin !== "string") return null;
  const { data, error } = await sb
    .from("developers")
    .select(select)
    .eq("github_login", githubLogin)
    .single();
  if (error || !data) return null;
  const row = data as unknown as Record<string, unknown>;
  if (row.claimed_by !== userId) return null;
  return data as unknown as T;
}
