-- ============================================================
-- developers.store_domain: domínio normalizado da loja (Dash)
-- Preenchido para developers criados a partir de lojas (github_login no formato platform_storeId_userId).
-- ============================================================

ALTER TABLE developers
  ADD COLUMN IF NOT EXISTS store_domain text;
