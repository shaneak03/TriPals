-- Seed data for scenic walks (Milan). Idempotent: rerunning updates rows in place.
-- Run after migrations/20261003191500_scenic_walks.sql.

-- City. The bbox covers Porta Garibaldi, Brera, the Duomo and south to the Darsena.
insert into public.cities (id, name, country, location_id, bbox, centre, is_active)
values (
  'milan', 'Milan', 'Italy',
  -- Link to the journey-search location row, if one exists (read-only lookup).
  (select l.id from public.locations l
    where l.name = 'Milan' and l.location_type = 'city'
    order by (l.country_code = 'IT') desc nulls last, l.created_at
    limit 1),
  extensions.st_makeenvelope(9.170, 45.448, 9.200, 45.490, 4326),
  extensions.st_setsrid(extensions.st_makepoint(9.1875, 45.470), 4326),
  true
)
on conflict (id) do update set
  name = excluded.name, country = excluded.country, location_id = excluded.location_id,
  bbox = excluded.bbox, centre = excluded.centre, is_active = excluded.is_active;

-- POI categories. When a feature matches several, the highest weight wins.
insert into public.poi_categories (id, label, osm_tags, weight, icon, sort_order) values
  ('attraction',       'Landmark',   '{"tourism": ["attraction"]}',      3, 'Camera',          1),
  ('museum',           'Museum',     '{"tourism": ["museum"]}',          3, 'Landmark',        2),
  ('gallery',          'Gallery',    '{"tourism": ["gallery"]}',         3, 'Palette',         3),
  ('artwork',          'Artwork',    '{"tourism": ["artwork"]}',         3, 'Brush',           4),
  ('viewpoint',        'Viewpoint',  '{"tourism": ["viewpoint"]}',       3, 'Eye',             5),
  ('historic',         'Historic',   '{"historic": "*"}',                3, 'Castle',          6),
  ('place_of_worship', 'Church',     '{"amenity": ["place_of_worship"]}', 2, 'Church',         7),
  ('fountain',         'Fountain',   '{"amenity": ["fountain"]}',        2, 'Droplets',        8),
  ('park',             'Park',       '{"leisure": ["park"]}',            2, 'Trees',           9),
  ('garden',           'Garden',     '{"leisure": ["garden"]}',          2, 'Flower2',        10),
  ('cafe',             'Café',       '{"amenity": ["cafe"]}',            1, 'Coffee',         11),
  ('restaurant',       'Restaurant', '{"amenity": ["restaurant"]}',      1, 'UtensilsCrossed', 12),
  ('bar',              'Bar',        '{"amenity": ["bar"]}',             1, 'Wine',           13),
  ('shop',             'Shop',       '{"shop": "*"}',                    1, 'ShoppingBag',    14)
on conflict (id) do update set
  label = excluded.label, osm_tags = excluded.osm_tags, weight = excluded.weight,
  icon = excluded.icon, sort_order = excluded.sort_order;

-- Places a walk can start or end at.
insert into public.places (slug, city_id, name, location, kind, is_selectable)
select slug, 'milan', name, extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326), kind, true
from (values
  ('garibaldi-station', 'Hotel by Porta Garibaldi station', 45.4846, 9.1873, 'hotel'),
  ('porta-garibaldi',   'Porta Garibaldi',                  45.4801, 9.1875, 'landmark'),
  ('duomo',             'Duomo di Milano',                  45.4641, 9.1900, 'landmark'),
  ('brera-academy',     'Brera Academy',                    45.4719, 9.1879, 'landmark'),
  ('pinacoteca-brera',  'Pinacoteca di Brera',              45.4721, 9.1881, 'landmark'),
  ('castello',          'Castello Sforzesco',               45.4695, 9.1795, 'landmark'),
  ('galleria',          'Galleria Vittorio Emanuele II',    45.4655, 9.1900, 'landmark'),
  ('navigli',           'Navigli (Darsena)',                45.4525, 9.1765, 'other')
) as v(slug, name, lat, lng, kind)
on conflict (slug) do update set
  city_id = excluded.city_id, name = excluded.name, location = excluded.location,
  kind = excluded.kind, is_selectable = excluded.is_selectable;

-- Preset walks. sort_order 1 is the default shown on /walks.
insert into public.route_pairs (id, city_id, start_place_id, end_place_id, label, sort_order, is_active)
select v.id, 'milan', s.id, e.id, v.label, v.sort_order, true
from (values
  ('garibaldi-duomo',      'garibaldi-station', 'duomo',            'Porta Garibaldi station to the Duomo',      1),
  ('brera-castello',       'brera-academy',     'castello',         'Brera Academy to Castello Sforzesco',       2),
  ('duomo-navigli',        'duomo',             'navigli',          'Duomo to the Navigli',                      3),
  ('castello-galleria',    'castello',          'galleria',         'Castello Sforzesco to the Galleria',        4),
  ('garibaldi-pinacoteca', 'porta-garibaldi',   'pinacoteca-brera', 'Porta Garibaldi to the Pinacoteca di Brera', 5)
) as v(id, start_slug, end_slug, label, sort_order)
join public.places s on s.slug = v.start_slug
join public.places e on e.slug = v.end_slug
on conflict (id) do update set
  city_id = excluded.city_id, start_place_id = excluded.start_place_id, end_place_id = excluded.end_place_id,
  label = excluded.label, sort_order = excluded.sort_order, is_active = excluded.is_active;

-- Extra-time budgets for the slider. Clear the old default first (one-default index).
update public.time_budgets set is_default = false where is_default and minutes <> 10;
insert into public.time_budgets (minutes, label, sort_order, is_default) values
  (0,  'No extra time', 0, false),
  (5,  '+5 min',        1, false),
  (10, '+10 min',       2, true),
  (15, '+15 min',       3, false),
  (20, '+20 min',       4, false),
  (30, '+30 min',       5, false)
on conflict (minutes) do update set
  label = excluded.label, sort_order = excluded.sort_order, is_default = excluded.is_default;
