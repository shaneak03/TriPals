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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Walk routing data (Milan)

The `/walks` planner uses data precomputed offline from OpenStreetMap, so the demo never calls a live API. The pipeline lives in `scripts/routing/` (settings in `config.py`). Outputs in `public/data/` are committed; raw OSM downloads go to `scripts/routing/cache/` (gitignored).

```bash
cd scripts/routing
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

.venv/bin/python fetch.py   # walk network + named POIs -> public/data/milan_pois.geojson
```

`fetch.py` downloads the walk network for the bounding box in `config.py` (plus a ~300 m buffer) and every named POI matching `POI_RULES`. POI weights are 3 for tourism sights and historic features, 2 for places of worship, fountains, parks and gardens, and 1 for cafés, restaurants, bars and shops. Same-name POIs less than 15 m apart are merged. HTTP responses are cached, so reruns are fast; delete `cache/` to force a fresh download.

```bash
.venv/bin/python score.py   # cache/milan_walk_scored.graphml + summary stats
```

`score.py` projects the graph and POIs to EPSG:32632 (metres) and tags each edge with `poi_ids` (POIs within 30 m of the edge, `;`-separated) and `poi_score` (the sum of their weights). Parks and buildings count when the street passes within 30 m of their outline. It prints the share of scored segments and the top streets so you can sanity-check the weights.

```bash
.venv/bin/python routing.py  # demo: Porta Garibaldi -> Duomo at every budget
```

`routing.py` computes the fastest route (shortest by length) and, for each extra-time budget at 4.8 km/h, a "most to see" route. Scenic edge cost is `max(length − λ·poi_score·k, 0.05·length)`, with `k` = median edge length ÷ median non-zero score. Candidates come from a λ sweep (0–5, step 0.1) plus start → via → end routes for λ ∈ {0, 0.3, 0.6, 1}; via routes are needed because large λ pushes every scored edge onto the cost floor, so the sweep alone stops adding detours. For each budget the winner is the candidate with the highest weighted score of unique POIs within 30 m whose length fits the budget (ties: more POIs, then shorter).

```bash
.venv/bin/python precompute.py  # -> public/data/routes/<pair_id>.json + index.json
```

`precompute.py` runs every preset pair in `config.py` (`PLACES`, `PAIRS`) at budgets 0, 5, 10, 15, 20 and 30 min. Each file holds `start`, `end`, `fastest`, `scenic` (keyed by budget) and the `pois` those routes pass. A route has a GeoJSON `geometry`, `distance_m`, `duration_min`, `poi_ids` in walking order with matching `poi_minutes`, and `poi_score`; scenic routes add `extra_min` and `extra_pois`. It then checks the acceptance criteria (every scenic route within budget, +0 equals fastest, main pair at +10 min ≥ 2× the POIs) and exits non-zero if one fails.

Full rerun after changing weights or the bbox: `fetch.py`, `score.py`, `precompute.py` (about a minute with a warm cache).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
