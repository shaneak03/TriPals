"""Step 4: precompute every preset walk at every budget for the frontend.

Writes public/data/routes/<pair_id>.json and public/data/routes/index.json, then
checks the acceptance criteria. Exits non-zero if any check fails (files are still written).
"""

import json
import sys

from config import BUDGETS_MIN, MAIN_PAIR, PAIRS, PLACES, ROUTES_DIR
from routing import calibrate_k, load_graph, load_pois_by_id, nearest_node, plan


def place(key):
    name, lat, lng = PLACES[key]
    return {"id": key, "name": name, "lat": lat, "lng": lng}


def build_pair(graph, pois_by_id, k, pair_id, start_key, end_key):
    start, end = place(start_key), place(end_key)
    source = nearest_node(graph, start["lat"], start["lng"])
    target = nearest_node(graph, end["lat"], end["lng"])
    fastest, scenic = plan(graph, pois_by_id, source, target, BUDGETS_MIN, k)

    used = set(fastest["poi_ids"]).union(*(s["poi_ids"] for s in scenic.values()))
    pois = [
        {key: pois_by_id[pid][key] for key in ("id", "name", "category", "weight", "lat", "lng")}
        for pid in sorted(used)
    ]
    return {"id": pair_id, "start": start, "end": end, "fastest": fastest, "scenic": scenic, "pois": pois}


def check(result):
    """Return a list of failed acceptance checks for one pair."""
    failures = []
    fastest = result["fastest"]
    for budget, route in result["scenic"].items():
        if route["extra_min"] > int(budget) + 1e-6:
            failures.append(f"+{budget} min route takes {route['extra_min']} extra min")
    zero = result["scenic"]["0"]
    if zero["geometry"] != fastest["geometry"]:
        failures.append(f"+0 route differs from fastest ({zero['distance_m']} vs {fastest['distance_m']} m)")
    if result["id"] == MAIN_PAIR:
        ten = result["scenic"]["10"]
        ratio = len(ten["poi_ids"]) / max(len(fastest["poi_ids"]), 1)
        if ratio < 2:
            failures.append(f"+10 min passes {ratio:.2f}x the unique POIs of the fastest route (target 2x)")
    return failures


def main():
    graph = load_graph()
    pois_by_id = load_pois_by_id()
    k = calibrate_k(graph)
    ROUTES_DIR.mkdir(parents=True, exist_ok=True)

    index, failures = [], []
    for pair_id, start_key, end_key in PAIRS:
        result = build_pair(graph, pois_by_id, k, pair_id, start_key, end_key)
        path = ROUTES_DIR / f"{pair_id}.json"
        path.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
        index.append({"id": pair_id, "start": result["start"], "end": result["end"]})

        f = result["fastest"]
        print(f"\n{result['start']['name']} -> {result['end']['name']}  ({path.name}, {path.stat().st_size // 1024} KB)")
        print(f"  fastest  {f['distance_m']:>5} m  {f['duration_min']:>5} min  {len(f['poi_ids']):>4} POIs  score {f['poi_score']}")
        for budget, s in result["scenic"].items():
            print(f"  +{budget:<2} min  {s['distance_m']:>5} m  {s['duration_min']:>5} min  {len(s['poi_ids']):>4} POIs  "
                  f"score {s['poi_score']:<4} (+{s['extra_min']} min, {s['extra_pois']:+} POIs)")
        failures += [f"{pair_id}: {msg}" for msg in check(result)]

    (ROUTES_DIR / "index.json").write_text(json.dumps({"pairs": index, "budgets": BUDGETS_MIN}, ensure_ascii=False, indent=2))

    print("\nAcceptance checks:")
    if failures:
        for msg in failures:
            print(f"  ✗ {msg}")
        sys.exit(1)
    print("  ✓ all passed")


if __name__ == "__main__":
    main()
