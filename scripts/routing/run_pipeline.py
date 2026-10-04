"""Compute a city's walks and write them to Supabase.

  python run_pipeline.py --city milan                        # every active pair
  python run_pipeline.py --city milan --pair garibaldi-duomo # just one pair
  python run_pipeline.py --city milan --export-fallback      # also refresh public/data/walks
  python run_pipeline.py --city milan --street-stats         # print street-score stats, write nothing

Config (bbox, categories, places, pairs, budgets) is read from Supabase. The OSM
download and street scoring are cached in .cache/walkroute/<city>/ and redone automatically when
the bbox or POI categories change (or with --refresh). Idempotent: rerunning replaces
the city's routes, so edits in the dashboard show up on /walks after one run.
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")  # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

from walkroute import db, score  # noqa: E402  (needs the env loaded first)
from walkroute.cache import ensure_scored_graph  # noqa: E402
from walkroute.config import DATA_DIR  # noqa: E402
from walkroute.routing import load_city_graph  # noqa: E402
from walkroute.walks import build_pair, check, print_result  # noqa: E402

FALLBACK_DIR = DATA_DIR / "walks"


def route_rows(result) -> list[dict]:
    """Shape a computed pair for replace_pair_routes()."""

    def row(route, kind, budget):
        return {
            "kind": kind,
            "budget_min": budget,
            "geometry": route["geometry"],
            "distance_m": route["distance_m"],
            "duration_min": route["duration_min"],
            "extra_min": route.get("extra_min"),
            "extra_pois": route.get("extra_pois"),
            "poi_score": route["poi_score"],
            "pois": [{"id": pid, "minute": m} for pid, m in zip(route["poi_ids"], route["poi_minutes"])],
        }

    return [row(result["fastest"], "fastest", None)] + [
        row(route, "scenic", int(budget)) for budget, route in result["scenic"].items()
    ]


def export_fallback(city: db.CityConfig) -> None:
    """Write what /walks reads from Supabase to static JSON, for when Supabase is unreachable."""
    out = FALLBACK_DIR / city.id
    (out / "routes").mkdir(parents=True, exist_ok=True)
    options = db.walk_options(city.id)
    (out / "options.json").write_text(json.dumps(options, ensure_ascii=False, indent=2))
    keep = set()
    for pair in options["pairs"]:
        path = out / "routes" / f"{pair['id']}.json"
        path.write_text(json.dumps(db.walk_routes(pair["id"]), ensure_ascii=False, separators=(",", ":")))
        keep.add(path.name)
    for stale in (out / "routes").glob("*.json"):
        if stale.name not in keep:
            stale.unlink()
    print(f"Exported fallback for {len(keep)} pairs -> {out.relative_to(DATA_DIR.parent.parent)}")
    export_city_list()


def export_city_list() -> None:
    """public/data/walks/cities.json: the city selector's fallback (same shape as the web app's City)."""
    rows = db.client().table("cities").select("id, name, country, bbox, centre").eq("is_active", True).order("name").execute().data
    cities = []
    for r in rows:
        ring = r["bbox"]["coordinates"][0]
        xs, ys = [c[0] for c in ring], [c[1] for c in ring]
        cities.append({"id": r["id"], "name": r["name"], "country": r["country"],
                       "bbox": [min(xs), min(ys), max(xs), max(ys)], "centre": r["centre"]["coordinates"]})
    (FALLBACK_DIR / "cities.json").write_text(json.dumps(cities, ensure_ascii=False, indent=2))
    print(f"Exported {len(cities)} cities -> public/data/walks/cities.json")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--city", default="milan", help="city id (default: milan)")
    parser.add_argument("--pair", action="append", help="only recompute this pair id (repeatable)")
    parser.add_argument("--refresh", action="store_true", help="re-download OSM data and rescore streets")
    parser.add_argument("--export-fallback", action="store_true", help="write public/data/walks/<city>/ from Supabase")
    parser.add_argument("--street-stats", action="store_true", help="print street-score stats and exit")
    args = parser.parse_args()

    run_started = datetime.now(timezone.utc).isoformat()
    city = db.load_city(args.city)
    pairs = city.pairs
    if args.pair:
        unknown = set(args.pair) - {p.id for p in city.pairs}
        if unknown:
            sys.exit(f"Not an active pair in {city.id}: {', '.join(sorted(unknown))}")
        pairs = [p for p in city.pairs if p.id in args.pair]
    print(f"{city.name}: {len(pairs)} pair(s), budgets {city.budgets}, CRS {city.crs}")

    ensure_scored_graph(city, args.refresh)
    if args.street_stats:
        score.main(city.id, city.crs, summary=True)
        return

    cg = load_city_graph(city)
    print(f"Upserting {len(cg.pois_by_id):,} POIs…")
    db.upsert_pois(city.id, list(cg.pois_by_id.values()), run_started)

    failures = []
    for pair in pairs:
        result = build_pair(cg, pair, city.budgets)
        written = db.replace_pair_routes(pair.id, route_rows(result))
        print_result(result)
        print(f"  -> wrote {written} routes")
        failures += [f"{pair.id}: {m}" for m in check(result, is_main_pair=pair.id == city.pairs[0].id)]

    if not args.pair:
        # Full city run: drop what no longer belongs (inactive pairs, POIs gone from OSM).
        print(f"\nRemoved routes of {db.delete_routes_of_inactive_pairs(city.id)} inactive-pair route(s); "
              f"pruned {db.prune_pois(city.id, run_started)} stale POI(s).")

    if args.export_fallback:
        export_fallback(city)

    print("\nAcceptance checks:")
    if failures:
        for msg in failures:
            print(f"  ✗ {msg}")
        sys.exit(1)
    print("  ✓ all passed")


if __name__ == "__main__":
    main()
