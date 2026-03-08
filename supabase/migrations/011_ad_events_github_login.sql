-- Sky Ads catalog (moves from hardcoded to DB)
create table sky_ads (
  id text primary key,
  brand text not null,
  text text not null,
  description text,
  color text not null default '#f8d880',
  bg_color text not null default '#1a1018',
  link text,
  vehicle text not null default 'plane' check (vehicle in ('plane', 'blimp')),
  priority integer not null default 50,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- Ad events (impressions + clicks in one table, type column)
create table sky_ad_events (
  id bigint generated always as identity primary key,
  ad_id text not null references sky_ads(id),
  event_type text not null check (event_type in ('impression', 'click', 'cta_click')),
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_sky_ad_events_ad_id on sky_ad_events(ad_id);
create index idx_sky_ad_events_created on sky_ad_events(created_at);
create index idx_sky_ad_events_type on sky_ad_events(ad_id, event_type);

-- Daily aggregate materialized view (fast dashboard queries)
create materialized view sky_ad_daily_stats as
select
  ad_id,
  date_trunc('day', created_at)::date as day,
  count(*) filter (where event_type = 'impression') as impressions,
  count(*) filter (where event_type = 'click') as clicks,
  count(*) filter (where event_type = 'cta_click') as cta_clicks
from sky_ad_events
group by ad_id, date_trunc('day', created_at)::date;

create unique index idx_sky_ad_daily_stats on sky_ad_daily_stats(ad_id, day);

-- RLS: public read for active ads, insert events via service role only
alter table sky_ads enable row level security;
alter table sky_ad_events enable row level security;

create policy "Public can read active ads"
  on sky_ads for select using (active = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

-- No policies on sky_ad_events: RLS blocks all anon/authenticated access.
-- Only service role (used by our API routes) can insert/read, bypassing RLS.

-- Helper function to refresh the materialized view (called from API)
create or replace function refresh_sky_ad_stats()
returns void language plpgsql security definer as $$
begin
  refresh materialized view concurrently sky_ad_daily_stats;
end;
$$;

-- Seed default ads
insert into sky_ads (id, brand, text, description, color, bg_color, link, vehicle, priority) values
  ('shopify', 'Shopify', 'CRIE SUA LOJA VIRTUAL', 'A maior plataforma global de e-commerce para montar sua loja online com ferramentas profissionais.', '#95bf47', '#1a1018', 'https://www.shopify.com.br', 'plane', 100),
  ('yampi', 'Yampi', 'CRIE SUA LOJA VIRTUAL', 'Checkout transparente e gestão completa de pedidos para maximizar suas conversões.', '#ab62ef', '#1a1018', 'https://www.yampi.com.br', 'plane', 90),
  ('nuvemshop', 'Nuvemshop', 'CRIE SUA LOJA VIRTUAL', 'Plataforma líder de e-commerce na América Latina. Crie e gerencie sua loja virtual com facilidade.', '#0855c5', '#1a1018', 'https://www.nuvemshop.com.br', 'blimp', 80),
  ('tray', 'Tray', 'CRIE SUA LOJA VIRTUAL', 'Solução completa de e-commerce com gestão integrada de produtos, pedidos, frete e pagamentos.', '#141057', '#1a1018', 'https://www.tray.com.br', 'plane', 70),
  ('empreender', 'Empreender', 'EMPREENDA SEU NEGÓCIO', 'Somos parceiros de mais de 30 plataformas. Nossos apps estão disponíveis na Shopify, Nuvemshop, Yampi, Tray, Loja Integrada e muito mais!', '#a16bf9', '#1a1018', 'https://empreender.com.br', 'plane', 60),
  ('montink', 'Montink', 'PRINT ON DEMAND', 'Somos uma plataforma de Print On Demand, onde pessoas ou empresas conseguem ter seus produtos personalizados com suas estampas, vender e lucrar muito.', '#f70293', '#1a1018', 'https://www.montink.com', 'blimp', 50),
  ('kiwify', 'Kiwify', 'VENDA INFOPRODUTOS', 'Plataforma completa para vender infoprodutos, cursos online e gerenciar programas de afiliados.', '#09b36e', '#1a1018', 'https://kiwify.com.br', 'plane', 45),
  ('googleanalytics4', 'Google Analytics', 'ANÁLISE DO SEU SITE', 'Monitore o desempenho do seu site com análises detalhadas de tráfego, conversões e comportamento dos usuários.', '#f27e0a', '#1a1018', 'https://analytics.google.com', 'blimp', 40),
  ('meta', 'Meta', 'CAMPANHAS FACEBOOK E INSTAGRAM', 'Gerencie e otimize campanhas publicitárias no Facebook e Instagram para alcançar seu público-alvo.', '#0a69d4', '#1a1018', 'https://www.facebook.com/business/ads', 'plane', 35),
  ('bling', 'Bling', 'GESTÃO EMPRESARIAL', 'Sistema de gestão empresarial (ERP) para automatizar estoque, notas fiscais e controle financeiro.', '#3aaf67', '#1a1018', 'https://www.bling.com.br', 'plane', 30),
  ('tiktokshop', 'TikTok Shop', 'VENDA NO TIKTOK', 'Venda seus produtos diretamente no TikTok e alcance milhões de usuários pelo social commerce.', '#ff3156', '#1a1018', 'https://shop.tiktok.com', 'blimp', 25),
  ('lojaintegrada', 'CRIE SUA LOJA VIRTUAL', 'LOJA VIRTUAL GRATUITA', 'Plataforma brasileira de e-commerce gratuita para criar, personalizar e gerenciar sua loja online.', '#32c6c5', '#1a1018', 'https://lojaintegrada.com.br', 'plane', 20);

-- Add github_login to sky_ad_events so we know which logged-in user
-- triggered the event (nullable — anonymous visitors won't have it).
alter table sky_ad_events add column github_login text;

create index idx_sky_ad_events_login on sky_ad_events(github_login)
  where github_login is not null;
