"""Compute one walk (fastest + scenic per budget) and check it against the acceptance criteria.

Used by run_pipeline.py, which writes the results to Supabase.
"""

from db import Pair
from routing import nearest_node, plan


def place_json(place):
    return {"id": place.slug, "name": place.name, "lat": place.lat, "lng": place.lng}


def build_pair(graph, pois_by_id, k, pair: Pair, budgets):
    source = nearest_node(graph, pair.start.lat, pair.start.lng)
    target = nearest_node(graph, pair.end.lat, pair.end.lng)
    fastest, scenic = plan(graph, pois_by_id, source, target, budgets, k)
    return {
        "id": pair.id,
        "label": pair.label,
        "start": place_json(pair.start),
        "end": place_json(pair.end),
        "fastest": fastest,
        "scenic": scenic,
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


def print_result(result):
    f = result["fastest"]
    print(f"\n{result['start']['name']} -> {result['end']['name']}  ({result['id']})")
    print(f"  fastest  {f['distance_m']:>5} m  {f['duration_min']:>5} min  {len(f['poi_ids']):>4} POIs  score {f['poi_score']}")
    for budget, s in result["scenic"].items():
        print(f"  +{budget:<2} min  {s['distance_m']:>5} m  {s['duration_min']:>5} min  {len(s['poi_ids']):>4} POIs  "
              f"score {s['poi_score']:<4} (+{s['extra_min']} min, {s['extra_pois']:+} POIs)")
