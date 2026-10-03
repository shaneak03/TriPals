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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
