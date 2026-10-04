-- Cache for the routing API (services/routing-api): one row per (city, start cell,
-- end cell) holding the full all-budgets response, so a repeated search is instant.
--
-- Cells are a ~20 m grid: cell_y = round(lat * 111320 / 20),
-- cell_x = round(lng * 111320 * cos(city centre lat) / 20).
-- inputs_hash covers the street scores, POI categories, time budgets and algorithm
-- version, so changing any of them in the dashboard bypasses old entries.
-- Only the service role reads or writes it; nothing here is exposed to the browser.

create table public.route_cache (
  city_id     text not null references public.cities (id) on delete cascade,
  inputs_hash text not null,
  from_y      int  not null,
  from_x      int  not null,
  to_y        int  not null,
  to_x        int  not null,
  response    jsonb not null,
  computed_at timestamptz not null default now(),
  primary key (city_id, inputs_hash, from_y, from_x, to_y, to_x)
);

create index route_cache_computed_at_idx on public.route_cache (computed_at);

alter table public.route_cache enable row level security;
-- No policies: anon/authenticated get nothing. The service role bypasses RLS.
revoke all on public.route_cache from anon, authenticated;
