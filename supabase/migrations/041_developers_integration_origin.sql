-- ============================================================
-- developers.integration_origin: identificador da sub origem da loja
-- ============================================================

ALTER TABLE developers
  ADD COLUMN IF NOT EXISTS integration_origin text not null default '';
