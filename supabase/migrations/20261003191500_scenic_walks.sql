-- Scenic walks: cities, POI categories, places, preset route pairs, time budgets,
-- POIs and precomputed routes. Written by scripts/routing (service role), read by
-- /walks (anon / publishable key) through get_walk_options() and get_routes().
--
-- Self-contained: does not modify any existing table. Safe to run once in the
-- Supabase SQL Editor.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------- tables

create table public.cities (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  name        text not null,
  country     text not null,
  -- Optional link to the journey-search location for this city (read-only reference).
  location_id uuid references public.locations (id) on delete set null,
  bbox        extensions.geometry(Polygon, 4326) not null,
  centre      extensions.geometry(Point, 4326) not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.poi_categories (
  id         text primary key,
  label      text not null,
  -- OSM tags that put a feature in this category: {"tourism": ["museum"]} or {"historic": "*"}.
  osm_tags   jsonb not null,
  weight     int  not null check (weight between 0 and 10),
  icon       text not null default 'MapPin', -- Lucide icon name
  sort_order int  not null default 0
);

create table public.places (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  city_id       text not null references public.cities (id) on delete cascade,
  name          text not null,
  location      extensions.geometry(Point, 4326) not null,
  kind          text not null default 'other' check (kind in ('hotel', 'landmark', 'station', 'other')),
  is_selectable boolean not null default true
);

create table public.route_pairs (
  id             text primary key check (id ~ '^[a-z0-9-]+$'),
  city_id        text not null references public.cities (id) on delete cascade,
  start_place_id uuid not null references public.places (id) on delete cascade,
  end_place_id   uuid not null references public.places (id) on delete cascade,
  label          text not null,
  sort_order     int  not null default 0,
  is_active      boolean not null default true,
  check (start_place_id <> end_place_id)
);

create table public.time_budgets (
  minutes    int primary key check (minutes >= 0),
  label      text not null,
  sort_order int  not null default 0,
  is_default boolean not null default false
);
-- At most one default budget.
create unique index time_budgets_one_default on public.time_budgets (is_default) where is_default;

create table public.pois (
  id          text primary key, -- OSM id, e.g. 'node/123'
  city_id     text not null references public.cities (id) on delete cascade,
  name        text not null,
  category_id text not null references public.poi_categories (id),
  weight      int  not null,
  location    extensions.geometry(Point, 4326) not null,
  description text,
  updated_at  timestamptz not null default now()
);

create table public.routes (
  id           uuid primary key default gen_random_uuid(),
  pair_id      text not null references public.route_pairs (id) on delete cascade,
  kind         text not null check (kind in ('fastest', 'scenic')),
  -- Deleting a time budget deletes its scenic routes.
  budget_min   int references public.time_budgets (minutes) on delete cascade,
  geometry     extensions.geometry(LineString, 4326) not null,
  distance_m   int not null,
  duration_min numeric(6, 1) not null,
  extra_min    numeric(6, 1),
  extra_pois   int,
  poi_score    int not null default 0,
  computed_at  timestamptz not null default now(),
  check ((kind = 'fastest') = (budget_min is null)),
  -- NULLS NOT DISTINCT so each pair has exactly one fastest route (budget_min is null).
  unique nulls not distinct (pair_id, kind, budget_min)
);

create table public.route_pois (
  route_id      uuid not null references public.routes (id) on delete cascade,
  poi_id        text not null references public.pois (id) on delete cascade,
  order_index   int  not null,
  minute_marker numeric(6, 1) not null,
  primary key (route_id, poi_id)
);

-- ---------------------------------------------------------------- indexes

create index cities_bbox_gix      on public.cities using gist (bbox);
create index cities_centre_gix    on public.cities using gist (centre);
create index places_location_gix  on public.places using gist (location);
create index pois_location_gix    on public.pois using gist (location);
create index routes_geometry_gix  on public.routes using gist (geometry);

create index routes_pair_id_idx       on public.routes (pair_id);
create index pois_city_id_idx         on public.pois (city_id);
create index places_city_id_idx       on public.places (city_id);
create index route_pairs_city_id_idx  on public.route_pairs (city_id);
create index route_pois_poi_id_idx    on public.route_pois (poi_id);

-- ---------------------------------------------------------------- access
-- Read-only for everyone; only the service role (the Python pipeline) writes.

do $$
declare
  t text;
begin
  foreach t in array array['cities', 'poi_categories', 'places', 'route_pairs', 'time_budgets', 'pois', 'routes', 'route_pois']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('create policy "Public read" on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------- read API
-- Both functions return plain JSON (GeoJSON geometry, lat/lng numbers) so the
-- frontend never handles PostGIS types. SECURITY INVOKER: RLS still applies.

-- Everything the /walks controls need: pairs, selectable places, budgets, categories.
create or replace function public.get_walk_options(p_city_id text)
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'city', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'country', c.country,
      'centre', jsonb_build_array(st_x(c.centre), st_y(c.centre)),
      'bbox', jsonb_build_array(st_xmin(c.bbox), st_ymin(c.bbox), st_xmax(c.bbox), st_ymax(c.bbox))
    ),
    'pairs', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', rp.id,
          'label', rp.label,
          'start', jsonb_build_object('id', sp.slug, 'name', sp.name, 'kind', sp.kind,
                                      'selectable', sp.is_selectable,
                                      'lat', st_y(sp.location), 'lng', st_x(sp.location)),
          'end', jsonb_build_object('id', ep.slug, 'name', ep.name, 'kind', ep.kind,
                                    'selectable', ep.is_selectable,
                                    'lat', st_y(ep.location), 'lng', st_x(ep.location))
        ) order by rp.sort_order, rp.id)
      from route_pairs rp
      join places sp on sp.id = rp.start_place_id
      join places ep on ep.id = rp.end_place_id
      where rp.city_id = c.id and rp.is_active
    ), '[]'::jsonb),
    'budgets', coalesce((
      select jsonb_agg(jsonb_build_object('minutes', tb.minutes, 'label', tb.label, 'is_default', tb.is_default)
                       order by tb.sort_order, tb.minutes)
      from time_budgets tb
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', pc.id, 'label', pc.label, 'icon', pc.icon, 'weight', pc.weight)
                       order by pc.weight desc, pc.sort_order)
      from poi_categories pc
    ), '[]'::jsonb)
  )
  from cities c
  where c.id = p_city_id and c.is_active;
$$;

-- One walk: fastest route, scenic route per budget (all budgets when p_budget_min
-- is null), and every POI those routes pass. Same shape as public/data/routes/*.json.
create or replace function public.get_routes(p_pair_id text, p_budget_min int default null)
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with pair as (
    select rp.*,
           jsonb_build_object('id', sp.slug, 'name', sp.name, 'lat', st_y(sp.location), 'lng', st_x(sp.location)) as start_json,
           jsonb_build_object('id', ep.slug, 'name', ep.name, 'lat', st_y(ep.location), 'lng', st_x(ep.location)) as end_json
    from route_pairs rp
    join places sp on sp.id = rp.start_place_id
    join places ep on ep.id = rp.end_place_id
    where rp.id = p_pair_id and rp.is_active
  ),
  selected_routes as (
    select r.*
    from routes r
    where r.pair_id = p_pair_id
      and (r.kind = 'fastest' or p_budget_min is null or r.budget_min = p_budget_min)
  ),
  route_json as (
    select r.kind, r.budget_min,
           jsonb_build_object(
             'geometry', st_asgeojson(r.geometry, 6)::jsonb,
             'distance_m', r.distance_m,
             'duration_min', r.duration_min,
             'extra_min', r.extra_min,
             'extra_pois', r.extra_pois,
             'poi_score', r.poi_score,
             'poi_ids', coalesce((select jsonb_agg(rpo.poi_id order by rpo.order_index)
                                  from route_pois rpo where rpo.route_id = r.id), '[]'::jsonb),
             'poi_minutes', coalesce((select jsonb_agg(rpo.minute_marker order by rpo.order_index)
                                      from route_pois rpo where rpo.route_id = r.id), '[]'::jsonb)
           ) as body
    from selected_routes r
  )
  select jsonb_build_object(
    'id', pair.id,
    'label', pair.label,
    'start', pair.start_json,
    'end', pair.end_json,
    'fastest', (select body from route_json where kind = 'fastest'),
    'scenic', coalesce((select jsonb_object_agg(budget_min::text, body)
                        from route_json where kind = 'scenic'), '{}'::jsonb),
    'pois', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', p.id, 'name', p.name, 'category', p.category_id,
          'category_label', pc.label, 'icon', pc.icon, 'weight', p.weight,
          'lat', round(st_y(p.location)::numeric, 6), 'lng', round(st_x(p.location)::numeric, 6)
        ) order by p.id)
      from pois p
      join poi_categories pc on pc.id = p.category_id
      where p.id in (select rpo.poi_id from route_pois rpo join selected_routes r on r.id = rpo.route_id)
    ), '[]'::jsonb)
  )
  from pair;
$$;

revoke execute on function public.get_walk_options(text), public.get_routes(text, int) from public;
grant execute on function public.get_walk_options(text), public.get_routes(text, int) to anon, authenticated, service_role;
