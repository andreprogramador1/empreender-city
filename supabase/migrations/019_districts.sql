-- 019_districts.sql
-- Sprint 1: Districts foundation

-- 1a. Districts reference table (10 rows seeded)
CREATE TABLE districts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  population INT DEFAULT 0,
  total_contributions BIGINT DEFAULT 0,
  weekly_score BIGINT DEFAULT 0,
  mayor_id INT REFERENCES developers(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO districts (id, name, color) VALUES
  ('nuvemshop',         'Nuvemshop',         '#3b82f6'),
  ('google_analytics',  'Google Analytics',  '#ef4444'),
  ('meta',              'Meta',              '#a855f7'),
  ('yampi',             'Yampi',             '#22c55e'),
  ('loja_integrada',    'Loja Integrada',    '#06b6d4'),
  ('tiktok_shop',       'TikTok Shop',       '#f97316'),
  ('tray',              'Tray',              '#dc2626'),
  ('shopify',           'Shopify',           '#ec4899'),
  ('bling',             'Bling',             '#8b5cf6'),
  ('kiwify',            'Kiwify',            '#eab308');

-- 1b. New columns on developers
ALTER TABLE developers ADD COLUMN district TEXT REFERENCES districts(id);
ALTER TABLE developers ADD COLUMN district_chosen BOOLEAN DEFAULT false;
ALTER TABLE developers ADD COLUMN district_changes_count INT DEFAULT 0;
ALTER TABLE developers ADD COLUMN district_changed_at TIMESTAMPTZ;
ALTER TABLE developers ADD COLUMN district_rank INT;
CREATE INDEX idx_developers_district ON developers(district);
CREATE INDEX idx_developers_district_rank ON developers(district, district_rank);

-- 1c. District changes history table
CREATE TABLE district_changes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  developer_id INT REFERENCES developers(id) NOT NULL,
  from_district TEXT REFERENCES districts(id),
  to_district TEXT REFERENCES districts(id) NOT NULL,
  reason TEXT DEFAULT 'inferred',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1d. Auto-inference for all existing devs
UPDATE developers SET district = CASE
  WHEN primary_language IN ('TypeScript','JavaScript','CSS','HTML','SCSS','Vue','Svelte') THEN 'nuvemshop'
  WHEN primary_language IN ('Java','Go','Rust','C#','PHP','Ruby','Elixir','C','C++','Assembly','Verilog','VHDL') THEN 'google_analytics'
  WHEN primary_language IN ('Python','Jupyter Notebook','R','Julia') THEN 'loja_integrada'
  WHEN primary_language IN ('Swift','Kotlin','Dart','Objective-C') THEN 'yampi'
  WHEN primary_language IN ('HCL','Shell','Dockerfile','Nix') THEN 'tiktok_shop'
  WHEN primary_language IN ('GDScript','Lua') THEN 'shopify'
  ELSE 'meta'
END
WHERE district IS NULL;

-- 1e. Update district population cache
UPDATE districts d SET population = (
  SELECT COUNT(*) FROM developers dev WHERE dev.district = d.id
);
