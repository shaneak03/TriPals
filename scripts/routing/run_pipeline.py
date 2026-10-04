"""Compute a city's walks and write them to Supabase.

  python run_pipeline.py --city milan                        # every active pair
  python run_pipeline.py --city milan --pair garibaldi-duomo # just one pair
  python run_pipeline.py --city milan --export-fallback      # also refresh public/data/walks

Config (bbox, categories, places, pairs, budgets) is read from Supabase. The OSM
download and street scoring are cached in cache/<city>/ and redone automatically when
the bbox or POI categories change (or with --refresh). Idempotent: rerunning replaces
the city's routes, so edits in the dashboard show up on /walks after one run.
"""

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone

import db
import fetch
import score
from config import CACHE_DIR, DATA_DIR, scored_graph_path
from precompute import build_pair, check, print_result
from routing import calibrate_k, load_graph, load_pois_by_id

FALLBACK_DIR = DATA_DIR / "walks"


def inputs_fingerprint(city: db.CityConfig) -> str:
    """Hash of everything the cached POIs and scored graph depend on."""
    inputs = {
        "bbox": city.bbox,
        "categories": [(c.id, c.osm_tags, c.weight, c.is_highlighted, c.highlight_if_tags) for c in city.categories],
    }
    return hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()


def ensure_scored_graph(city: db.CityConfig, refresh: bool) -> None:
    stamp = CACHE_DIR / city.id / "inputs.sha256"
    fingerprint = inputs_fingerprint(city)
    stale = not scored_graph_path(city.id).exists() or not stamp.exists() or stamp.read_text() != fingerprint
    if not (refresh or stale):
        print("Using cached OSM data and street scores (bbox and categories unchanged).")
        return
    print("Refreshing OSM data and street scores" + (" (--refresh)" if refresh else " (inputs changed)") + "…")
    fetch.setup_osmnx()
    fetch.fetch_graph(city)
    fetch.fetch_pois(city)
    score.main(city.id, summary=False)
    stamp.write_text(fingerprint)


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


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--city", default="milan", help="city id (default: milan)")
    parser.add_argument("--pair", action="append", help="only recompute this pair id (repeatable)")
    parser.add_argument("--refresh", action="store_true", help="re-download OSM data and rescore streets")
    parser.add_argument("--export-fallback", action="store_true", help="write public/data/walks/<city>/ from Supabase")
    args = parser.parse_args()

    run_started = datetime.now(timezone.utc).isoformat()
    city = db.load_city(args.city)
    pairs = city.pairs
    if args.pair:
        unknown = set(args.pair) - {p.id for p in city.pairs}
        if unknown:
            sys.exit(f"Not an active pair in {city.id}: {', '.join(sorted(unknown))}")
        pairs = [p for p in city.pairs if p.id in args.pair]
    print(f"{city.name}: {len(pairs)} pair(s), budgets {city.budgets}")

    ensure_scored_graph(city, args.refresh)
    pois_by_id = load_pois_by_id(city.id)
    print(f"Upserting {len(pois_by_id):,} POIs…")
    db.upsert_pois(city.id, list(pois_by_id.values()), run_started)

    graph = load_graph(city.id)
    k = calibrate_k(graph)
    failures = []
    for pair in pairs:
        result = build_pair(graph, pois_by_id, k, pair, city.budgets)
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
