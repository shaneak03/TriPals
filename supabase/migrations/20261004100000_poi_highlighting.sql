-- Which POIs are "highlighted" (pinned on the map, listed under "Along the way" and
-- counted as sights) is now data, not code. Every category still counts towards the
-- street score; highlighting only affects what is shown and how scenic routes are ranked.
--
--   poi_categories.is_highlighted     highlight every POI in this category
--   poi_categories.highlight_if_tags  otherwise, highlight POIs carrying any of these OSM
--                                     tags (e.g. gardens with a wikidata entry)
--   pois.is_highlighted               the per-POI result, written by the routing pipeline
--
-- Values are set by seed.sql (rerun it after this migration) and the pipeline.

alter table public.poi_categories
  add column is_highlighted    boolean not null default false,
  add column highlight_if_tags text[]  not null default '{}';

alter table public.pois
  add column is_highlighted boolean not null default false;

-- Expose the flags through the read RPCs (same shapes as before, plus the new fields).

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
      select jsonb_agg(jsonb_build_object('id', pc.id, 'label', pc.label, 'icon', pc.icon, 'weight', pc.weight,
                                          'is_highlighted', pc.is_highlighted)
                       order by pc.weight desc, pc.sort_order)
      from poi_categories pc
    ), '[]'::jsonb)
  )
  from cities c
  where c.id = p_city_id and c.is_active;
$$;

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
          'highlighted', p.is_highlighted,
          'lat', round(st_y(p.location)::numeric, 6), 'lng', round(st_x(p.location)::numeric, 6)
        ) order by p.id)
      from pois p
      join poi_categories pc on pc.id = p.category_id
      where p.id in (select rpo.poi_id from route_pois rpo join selected_routes r on r.id = rpo.route_id)
    ), '[]'::jsonb)
  )
  from pair;
$$;
