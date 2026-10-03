-- Atomic write path for the routing pipeline: replace one pair's routes and their
-- POI lists in a single transaction, so /walks never reads a half-written walk.
-- Only the service role may call it.

create or replace function public.replace_pair_routes(p_pair_id text, p_routes jsonb)
returns int
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  r          jsonb;
  v_route_id uuid;
  v_keep     uuid[] := '{}';
begin
  if not exists (select 1 from route_pairs where id = p_pair_id) then
    raise exception 'Unknown route pair %', p_pair_id;
  end if;

  -- p_routes: [{kind, budget_min, geometry (GeoJSON), distance_m, duration_min, extra_min,
  --             extra_pois, poi_score, pois: [{id, minute}] in walking order}, ...]
  for r in select * from jsonb_array_elements(p_routes)
  loop
    insert into routes (pair_id, kind, budget_min, geometry, distance_m, duration_min,
                        extra_min, extra_pois, poi_score, computed_at)
    values (
      p_pair_id,
      r ->> 'kind',
      (r ->> 'budget_min')::int,
      st_setsrid(st_geomfromgeojson((r -> 'geometry')::text), 4326),
      (r ->> 'distance_m')::int,
      (r ->> 'duration_min')::numeric,
      (r ->> 'extra_min')::numeric,
      (r ->> 'extra_pois')::int,
      coalesce((r ->> 'poi_score')::int, 0),
      now()
    )
    on conflict (pair_id, kind, budget_min) do update set
      geometry     = excluded.geometry,
      distance_m   = excluded.distance_m,
      duration_min = excluded.duration_min,
      extra_min    = excluded.extra_min,
      extra_pois   = excluded.extra_pois,
      poi_score    = excluded.poi_score,
      computed_at  = excluded.computed_at
    returning id into v_route_id;

    v_keep := v_keep || v_route_id;

    delete from route_pois where route_id = v_route_id;
    insert into route_pois (route_id, poi_id, order_index, minute_marker)
    select v_route_id, x.poi ->> 'id', (x.ord - 1)::int, (x.poi ->> 'minute')::numeric
    from jsonb_array_elements(r -> 'pois') with ordinality as x(poi, ord);
  end loop;

  -- Routes for budgets that are no longer computed (e.g. a removed time budget).
  delete from routes where pair_id = p_pair_id and not (id = any (v_keep));

  return cardinality(v_keep);
end;
$$;

revoke execute on function public.replace_pair_routes(text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_pair_routes(text, jsonb) to service_role;
