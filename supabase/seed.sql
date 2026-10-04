-- Seed data for scenic walks (Milan). Idempotent: rerunning updates rows in place.
-- Run after all migrations in supabase/migrations/.

-- Cities. Each bbox is kept to a few km (the walk graph is held in memory by the
-- routing API). location_id links to the journey-search location (read-only lookup).
--   milan:     Porta Garibaldi, Brera, the Duomo and south to the Darsena
--   paris:     Louvre, Marais, Île de la Cité and the Latin Quarter
--   barcelona: Ciutat Vella and the lower Eixample
insert into public.cities (id, name, country, location_id, bbox, centre, is_active)
select v.id, v.name, v.country,
       (select l.id from public.locations l
         where l.name = v.name and l.location_type = 'city'
         order by (l.country_code = v.country_code) desc nulls last, l.created_at
         limit 1),
       extensions.st_makeenvelope(v.west, v.south, v.east, v.north, 4326),
       extensions.st_setsrid(extensions.st_makepoint(v.lng, v.lat), 4326),
       true
from (values
  ('milan',     'Milan',     'Italy',  'IT', 9.170, 45.448, 9.200, 45.490, 9.1875, 45.470),
  ('paris',     'Paris',     'France', 'FR', 2.325, 48.845, 2.375, 48.870, 2.3480, 48.8575),
  ('barcelona', 'Barcelona', 'Spain',  'ES', 2.160, 41.375, 2.195, 41.400, 2.1760, 41.3860)
) as v(id, name, country, country_code, west, south, east, north, lng, lat)
on conflict (id) do update set
  name = excluded.name, country = excluded.country, location_id = excluded.location_id,
  bbox = excluded.bbox, centre = excluded.centre, is_active = excluded.is_active;

-- POI categories. When a feature matches several, the highest weight wins. Every
-- category counts towards the street score; highlighted ones are also pinned, listed and
-- counted as sights. Gardens are highlighted only when notable (they have a wikidata or
-- wikipedia tag, e.g. Orto Botanico di Brera), not every courtyard or cloister.
insert into public.poi_categories (id, label, osm_tags, weight, icon, sort_order, is_highlighted, highlight_if_tags) values
  ('attraction',       'Landmark',   '{"tourism": ["attraction"]}',       3, 'Camera',           1, true,  '{}'),
  ('museum',           'Museum',     '{"tourism": ["museum"]}',           3, 'Landmark',         2, true,  '{}'),
  ('gallery',          'Gallery',    '{"tourism": ["gallery"]}',          3, 'Palette',          3, true,  '{}'),
  ('artwork',          'Artwork',    '{"tourism": ["artwork"]}',          3, 'Brush',            4, true,  '{}'),
  ('viewpoint',        'Viewpoint',  '{"tourism": ["viewpoint"]}',        3, 'Eye',              5, true,  '{}'),
  ('historic',         'Historic',   '{"historic": "*"}',                 3, 'Castle',           6, true,  '{}'),
  ('place_of_worship', 'Church',     '{"amenity": ["place_of_worship"]}', 2, 'Church',           7, true,  '{}'),
  ('fountain',         'Fountain',   '{"amenity": ["fountain"]}',         2, 'Droplets',         8, true,  '{}'),
  ('park',             'Park',       '{"leisure": ["park"]}',             2, 'Trees',            9, true,  '{}'),
  ('garden',           'Garden',     '{"leisure": ["garden"]}',           2, 'Flower2',         10, false, '{wikidata,wikipedia}'),
  ('cafe',             'Café',       '{"amenity": ["cafe"]}',             1, 'Coffee',          11, false, '{}'),
  ('restaurant',       'Restaurant', '{"amenity": ["restaurant"]}',       1, 'UtensilsCrossed', 12, false, '{}'),
  ('bar',              'Bar',        '{"amenity": ["bar"]}',              1, 'Wine',            13, false, '{}'),
  ('shop',             'Shop',       '{"shop": "*"}',                     1, 'ShoppingBag',     14, false, '{}')
on conflict (id) do update set
  label = excluded.label, osm_tags = excluded.osm_tags, weight = excluded.weight,
  icon = excluded.icon, sort_order = excluded.sort_order,
  is_highlighted = excluded.is_highlighted, highlight_if_tags = excluded.highlight_if_tags;

-- Places a walk can start or end at.
insert into public.places (slug, city_id, name, location, kind, is_selectable)
select slug, city_id, name, extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326), kind, true
from (values
  ('garibaldi-station',  'milan',     'Hotel by Porta Garibaldi station', 45.4846, 9.1873, 'hotel'),
  ('porta-garibaldi',    'milan',     'Porta Garibaldi',                  45.4801, 9.1875, 'landmark'),
  ('duomo',              'milan',     'Duomo di Milano',                  45.4641, 9.1900, 'landmark'),
  ('brera-academy',      'milan',     'Brera Academy',                    45.4719, 9.1879, 'landmark'),
  ('pinacoteca-brera',   'milan',     'Pinacoteca di Brera',              45.4721, 9.1881, 'landmark'),
  ('castello',           'milan',     'Castello Sforzesco',               45.4695, 9.1795, 'landmark'),
  ('galleria',           'milan',     'Galleria Vittorio Emanuele II',    45.4655, 9.1900, 'landmark'),
  ('navigli',            'milan',     'Navigli (Darsena)',                45.4525, 9.1765, 'other'),
  ('louvre',             'paris',     'Louvre (Cour Napoléon)',           48.8606, 2.3376, 'landmark'),
  ('notre-dame',         'paris',     'Notre-Dame de Paris',              48.8530, 2.3487, 'landmark'),
  ('place-des-vosges',   'paris',     'Place des Vosges',                 48.8556, 2.3655, 'landmark'),
  ('pantheon',           'paris',     'Panthéon',                         48.8462, 2.3461, 'landmark'),
  ('placa-catalunya',    'barcelona', 'Plaça de Catalunya',               41.3870, 2.1700, 'landmark'),
  ('barceloneta',        'barcelona', 'Barceloneta beach',                41.3790, 2.1890, 'other'),
  ('casa-batllo',        'barcelona', 'Casa Batlló',                      41.3917, 2.1650, 'landmark'),
  ('barcelona-cathedral','barcelona', 'Barcelona Cathedral',              41.3840, 2.1762, 'landmark')
) as v(slug, city_id, name, lat, lng, kind)
on conflict (slug) do update set
  city_id = excluded.city_id, name = excluded.name, location = excluded.location,
  kind = excluded.kind, is_selectable = excluded.is_selectable;

-- Preset walks. sort_order 1 is the default shown on /walks.
insert into public.route_pairs (id, city_id, start_place_id, end_place_id, label, sort_order, is_active)
select v.id, s.city_id, s.id, e.id, v.label, v.sort_order, true
from (values
  ('garibaldi-duomo',       'garibaldi-station', 'duomo',               'Porta Garibaldi station to the Duomo',      1),
  ('brera-castello',        'brera-academy',     'castello',            'Brera Academy to Castello Sforzesco',       2),
  ('duomo-navigli',         'duomo',             'navigli',             'Duomo to the Navigli',                      3),
  ('castello-galleria',     'castello',          'galleria',            'Castello Sforzesco to the Galleria',        4),
  ('garibaldi-pinacoteca',  'porta-garibaldi',   'pinacoteca-brera',    'Porta Garibaldi to the Pinacoteca di Brera', 5),
  ('louvre-notre-dame',     'louvre',            'notre-dame',          'The Louvre to Notre-Dame',                  1),
  ('vosges-pantheon',       'place-des-vosges',  'pantheon',            'Place des Vosges to the Panthéon',          2),
  ('catalunya-barceloneta', 'placa-catalunya',   'barceloneta',         'Plaça de Catalunya to Barceloneta',         1),
  ('batllo-cathedral',      'casa-batllo',       'barcelona-cathedral', 'Casa Batlló to the Cathedral',              2)
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
