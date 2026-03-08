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
