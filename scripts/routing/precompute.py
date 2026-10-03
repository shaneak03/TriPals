"""Step 4: precompute every active walk of a city at every time budget.

Pairs, places and budgets come from Supabase. Writes public/data/routes/<pair_id>.json
and public/data/routes/index.json, then checks the acceptance criteria. Exits non-zero
if any check fails (files are still written).
"""

import argparse
import json
import sys

from config import ROUTES_DIR
from db import CityConfig, Pair, load_city
from routing import calibrate_k, load_graph, load_pois_by_id, nearest_node, plan


def place_json(place):
    return {"id": place.slug, "name": place.name, "lat": place.lat, "lng": place.lng}


def build_pair(graph, pois_by_id, k, pair: Pair, budgets):
    source = nearest_node(graph, pair.start.lat, pair.start.lng)
    target = nearest_node(graph, pair.end.lat, pair.end.lng)
    fastest, scenic = plan(graph, pois_by_id, source, target, budgets, k)

    used = set(fastest["poi_ids"]).union(*(s["poi_ids"] for s in scenic.values()))
    pois = [
        {key: pois_by_id[pid][key] for key in ("id", "name", "category", "weight", "lat", "lng")}
        for pid in sorted(used)
    ]
    return {
        "id": pair.id,
        "label": pair.label,
        "start": place_json(pair.start),
        "end": place_json(pair.end),
        "fastest": fastest,
        "scenic": scenic,
        "pois": pois,
    }


def check(result, is_main_pair):
    """Return a list of failed acceptance checks for one pair."""
    failures = []
    fastest = result["fastest"]
    for budget, route in result["scenic"].items():
        if route["extra_min"] > int(budget) + 1e-6:
            failures.append(f"+{budget} min route takes {route['extra_min']} extra min")
    zero = result["scenic"].get("0")
    if zero and zero["geometry"] != fastest["geometry"]:
        failures.append(f"+0 route differs from fastest ({zero['distance_m']} vs {fastest['distance_m']} m)")
    ten = result["scenic"].get("10")
    if is_main_pair and ten:
        ratio = len(ten["poi_ids"]) / max(len(fastest["poi_ids"]), 1)
        if ratio < 2:
            failures.append(f"+10 min passes {ratio:.2f}x the unique POIs of the fastest route (target 2x)")
    return failures


def print_result(result, note=""):
    f = result["fastest"]
    print(f"\n{result['start']['name']} -> {result['end']['name']}{note}")
    print(f"  fastest  {f['distance_m']:>5} m  {f['duration_min']:>5} min  {len(f['poi_ids']):>4} POIs  score {f['poi_score']}")
    for budget, s in result["scenic"].items():
        print(f"  +{budget:<2} min  {s['distance_m']:>5} m  {s['duration_min']:>5} min  {len(s['poi_ids']):>4} POIs  "
              f"score {s['poi_score']:<4} (+{s['extra_min']} min, {s['extra_pois']:+} POIs)")


def main(city: CityConfig):
    graph = load_graph(city.id)
    pois_by_id = load_pois_by_id(city.id)
    k = calibrate_k(graph)
    ROUTES_DIR.mkdir(parents=True, exist_ok=True)

    index, failures = [], []
    for i, pair in enumerate(city.pairs):
        result = build_pair(graph, pois_by_id, k, pair, city.budgets)
        path = ROUTES_DIR / f"{pair.id}.json"
        path.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
        index.append({"id": pair.id, "label": pair.label, "start": result["start"], "end": result["end"]})
        print_result(result, f"  ({path.name}, {path.stat().st_size // 1024} KB)")
        failures += [f"{pair.id}: {msg}" for msg in check(result, is_main_pair=i == 0)]

    (ROUTES_DIR / "index.json").write_text(
        json.dumps({"pairs": index, "budgets": city.budgets}, ensure_ascii=False, indent=2)
    )

    print("\nAcceptance checks:")
    if failures:
        for msg in failures:
            print(f"  ✗ {msg}")
        sys.exit(1)
    print("  ✓ all passed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--city", default="milan")
    main(load_city(parser.parse_args().city))
