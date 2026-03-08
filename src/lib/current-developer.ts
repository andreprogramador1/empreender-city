/**
 * Helpers para enviar o "developer atual" (loja em contexto) nas chamadas à API.
 * Um usuário pode ter vários developers (lojas). O frontend deve:
 * - Obter a lista via GET /api/profile (campo `developers`).
 * - Manter o developer atual: da URL em páginas /shop/[username] ou /dev/[username],
 *   ou de um seletor de loja (persistir em localStorage se quiser).
 * - Incluir github_login no body ou query de todas as APIs que atuam em nome da loja.
 */

export interface ProfileDeveloper {
  id: number;
  github_login: string;
  name: string | null;
  avatar_url: string | null;
  store_domain: string | null;
}

export interface ProfileResponse {
  allow_data_for_buildings: boolean;
  stores_synced_at: string | null;
  dash_user_id: number | null;
  developers: ProfileDeveloper[];
}

/** Adiciona github_login ao body para APIs que exigem o developer (loja) em contexto. */
export function withDeveloper<T extends Record<string, unknown>>(
  body: T,
  githubLogin: string
): T & { github_login: string } {
  return { ...body, github_login: githubLogin };
}

/** Query string com github_login para GET requests. */
export function queryWithDeveloper(params: URLSearchParams, githubLogin: string): string {
  const p = new URLSearchParams(params);
  p.set("github_login", githubLogin);
  return p.toString();
}
