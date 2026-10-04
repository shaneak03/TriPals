# TriPals routing API

FastAPI service behind `/walks`: the fastest walk and the "most to see" walk between
**any** two points in a loaded city, for every time budget, in one response. It reuses
the shared `walkroute` package (`packages/walkroute`), the same code the batch pipeline
in `scripts/routing` uses.

## Run locally

```bash
cd services/routing-api
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt   # run from this directory (relative -e path)
cp .env.example .env                        # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
.venv/bin/uvicorn app.main:app --port 8000
```

On first start each city's walk graph is downloaded from OpenStreetMap and scored
(about a minute per city, in a child process). It is cached in `.cache/walkroute/<city>/`
(gitignored, shared with the pipeline), so later starts take about a second. The cache
rebuilds itself when the city's bbox or POI categories change in Supabase.

Restart the API after changing cities, categories or time budgets in Supabase; config is
read at startup.

## Environment (`.env`, gitignored)

| Variable | |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Service role: reads config, reads/writes `route_cache`. Never expose it to the browser. |
| `ROUTING_CITIES` | Comma-separated city ids to load; empty = every active city. Measured: ~210 MB idle with Milan only; ~375 MB idle and ~410 MB peak with Milan, Paris and Barcelona. |
| `ALLOWED_ORIGINS` | Comma-separated browser origins for CORS (default `http://localhost:3000`). |
| `WALKROUTE_CACHE_DIR` | Optional cache location (default `<repo>/.cache/walkroute`). |

## Endpoints

`GET /route?from_lat&from_lng&to_lat&to_lng[&budget_min][&from_name][&to_name]`

Returns the shape `/walks` already uses (`get_routes` in Supabase): `fastest`, `scenic`
keyed by budget minutes (every budget in `time_budgets`, or just `budget_min`), and `pois`
in walking order with minute markers, each flagged `highlighted`. Plus `meta.cached` and
`meta.elapsed_ms`. Both points are snapped to the nearest walkable street.

| Status | When |
|---|---|
| 422 "That's a long walk; try somewhere closer." | more than 6 km apart in a straight line |
| 404 | outside every loaded city, or the two points are in different cities |
| 422 | no walkable street within 250 m, points too close together, or an unknown `budget_min` |

Results are cached in Supabase `route_cache` per city, ~20 m start/end cell and an inputs
hash (street scores, categories, budgets, algorithm version) for 30 days, so a repeated
search returns in well under a second. Uncached routes take about 0.5–2.5 s.

`GET /cities`: loaded cities (id, name, bbox, centre, budgets). `GET /health`.

## Deploying

Not set up yet. Needs Python 3.11+, about 512 MB of RAM for one city, and either a
persistent disk for `.cache/walkroute` or a build step that pre-builds the cache (building
a city's cache needs ~1 GB of RAM, more than a 512 MB instance has).
