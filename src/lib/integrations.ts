/**
 * Integrações (plataformas) válidas para o app.
 * Usado para validar distritos (district_id) e lojas retornadas pela API do Dash.
 */
export const VALID_INTEGRATIONS = [
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

export type ValidIntegration = (typeof VALID_INTEGRATIONS)[number];

/** Normaliza nome da plataforma para comparação (lowercase, sem underscores/espaços). */
export function normalizedPlatform(platform: string): string {
  return platform.toLowerCase().replace(/_/g, "").replace(/\s/g, "");
}

/**
 * Normaliza store_domain: adiciona https:// se não tiver, remove path/query (só domínio),
 * deixa minúsculo. Retorna "" se não for um domínio válido.
 */
export function normalizedStoreDomain(storeDomain: string): string {
  const s = storeDomain?.trim() ?? "";
  if (!s) return "";
  let urlStr = s;
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = "https://" + urlStr;
  }

  urlStr = urlStr.replace("http://", "https://");

  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();
    // Apenas hostname (sem path, query, port na saída)
    if (!hostname) return "";
    // Domínio válido: labels separados por ponto, cada label alfanumérico/hífen, tamanho mínimo
    const validDomain = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;
    if (!validDomain.test(hostname) || hostname.length < 4) return "";
    return "https://" + hostname;
  } catch {
    return "";
  }
}

/** Converte de volta para o mesmo nome que existe no Dash */
export function unnormalizedPlatform(platform: string): string {
  const map = {
    "nuvemshop": "Nuvemshop",
    "googleanalytics4": "Google Analytics 4",
    "meta": "Meta",
    "yampi": "Yampi",
    "lojaintegrada": "Loja Integrada",
    "tiktokshop": "TikTok Shop",
    "tray": "Tray",
    "shopify": "Shopify",
    "bling": "Bling",
    "kiwify": "Kiwify",
    "montink": "Montink"
  };

  return map[platform as keyof typeof map] ?? platform;
}

/** Verifica se a plataforma é uma integração válida para o app. */
export function isValidIntegration(platform: string): boolean {
  const normalized = platform;
  return VALID_INTEGRATIONS.some(
    (valid) => valid === normalized
  );
}
