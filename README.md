This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to load [Outfit](https://fonts.google.com/specimen/Outfit). `npm run dev` and `npm run build` first copy MapLibre's web worker into `public/maplibre/` (gitignored), which the `/walks` map needs.

## Environment variables

Copy the examples and fill them in. Real `.env` files are gitignored; never commit keys.

| File | Variable | Used by |
|---|---|---|
| `.env.local` (from `.env.example`) | `NEXT_PUBLIC_SUPABASE_URL` | browser + server |
| | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser (read-only through Row Level Security) |
| | `SUPABASE_SERVICE_ROLE_KEY` | server-only API routes (`src/lib/supabase/admin.ts`, guarded by `server-only`) |
| | `DUFFEL_API_TOKEN` | flight search (optional) |
| `scripts/routing/.env` (from `.env.example`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | the Python routing pipeline |
| `services/routing-api/.env` (from `.env.example`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ROUTING_CITIES`, `ALLOWED_ORIGINS` | the routing API (see `services/routing-api/README.md`) |

The service role key bypasses Row Level Security. It must never get a `NEXT_PUBLIC_` prefix or be imported from client code.

## Scenic walks (`/walks`)

`/walks` compares the fastest walk between two places with a "most to see" route that passes more points of interest within an extra-time budget. Everything it shows lives in Supabase:

| Table | What it holds | Edit it to… |
|---|---|---|
| `cities` | bbox, centre, `is_active`, optional link to `locations` | change the area covered (rerun pipeline) |
| `poi_categories` | OSM tags, weight, label, Lucide icon | re-weight or relabel categories (rerun pipeline for weights/tags) |
| `places` | named start/end points, `is_selectable` for the dropdowns | add or move start/end points |
| `route_pairs` | preset walks, label, `sort_order`, `is_active` | add, relabel, reorder or hide walks (rerun pipeline for new pairs) |
| `time_budgets` | slider steps, labels, `is_default` | change the slider (rerun pipeline for new budgets) |
| `pois`, `routes`, `route_pois` | pipeline output | — (written by the pipeline only) |

Labels, ordering, `is_active` and `is_selectable` changes show up on the next page load. Anything that changes routes (weights, OSM tags, bbox, new pairs or budgets) needs a pipeline run. Category icons must be one of the names in `src/lib/walk-icons.ts`; anything else shows a map pin.

The page reads through two RPCs that return plain JSON (GeoJSON geometry): `get_walk_options(city_id)` and `get_routes(pair_id[, budget_min])`. If Supabase is unreachable, it falls back to the static copy in `public/data/walks/<city>/` and says so.

### 1. Database setup (once)

In the Supabase dashboard's SQL Editor, run in order:

1. `supabase/migrations/20261003191500_scenic_walks.sql` (tables, indexes, RLS, read RPCs; enables PostGIS if needed)
2. `supabase/migrations/20261003203000_replace_pair_routes.sql` (the pipeline's atomic write RPC, service role only)
3. `supabase/migrations/20261004100000_poi_highlighting.sql` (which POIs are pinned and counted as sights)
4. `supabase/migrations/20261004120000_route_cache.sql` (the routing API's result cache, service role only)
5. `supabase/seed.sql` (Milan, Paris, Barcelona, POI categories, places, preset walks, budgets 0–30 min). Safe to rerun.

The migrations only create new objects; existing tables are untouched. All walk tables are read-only for `anon`/`authenticated`; only the service role writes.

### 2. Routing pipeline (Python)

```bash
cd scripts/routing
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # then fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

.venv/bin/python run_pipeline.py --city milan                        # every active walk
.venv/bin/python run_pipeline.py --city milan --pair garibaldi-duomo # just one walk
.venv/bin/python run_pipeline.py --city milan --export-fallback      # also refresh public/data/walks/milan
```

The routing code lives in the shared package `packages/walkroute` (installed into the venv by `requirements.txt`; run `pip install` from `scripts/routing`), which the routing API uses too. A run reads the city's config from Supabase, downloads the OSM walk network and named POIs (`walkroute/fetch.py`), scores each street by the POIs within 30 m (`walkroute/score.py`), computes the routes (`walkroute/routing.py`) and writes them back. It is idempotent: each walk's routes are replaced in one transaction (`replace_pair_routes`), and a full city run also deletes routes of inactive walks and POIs no longer in OSM. The OSM download and scoring are cached in `.cache/walkroute/<city>/` (gitignored, shared with the routing API) and redone automatically when the bbox or categories change; `--refresh` forces it. A full run takes about a minute.

After changing routes, rerun with `--export-fallback` and commit `public/data/walks/` so the offline fallback matches.

**How routes are chosen.** Fastest is the shortest path by length. For each budget (4.8 km/h), scenic edge cost is `max(length − λ·poi_score·k, 0.05·length)` with `k` = median edge length ÷ median non-zero score; every POI category counts towards `poi_score`. Candidates come from a λ sweep (0–2, step 0.1) plus start → via → end routes, searched only inside the ellipse of nodes a walk of that length can reach; the winner is the candidate passing the most highlighted sights (weighted), then the highest overall score, that fits the budget. The script prints acceptance checks (every route within budget, +0 equals fastest, main walk at +10 min ≥ 2× the POIs) and exits non-zero if one fails.

`run_pipeline.py --city milan --street-stats` prints street-score stats and the top streets without writing anything.

### 3. Routing API (any start and destination)

`services/routing-api` serves routes between any two points in a loaded city, cached in Supabase `route_cache`. See `services/routing-api/README.md` for running it (`uvicorn app.main:app --port 8000`).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
