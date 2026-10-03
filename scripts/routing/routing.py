"""Step 3: fastest vs "most to see" walking routes on the scored graph.

Run directly for a demo: Porta Garibaldi -> Duomo at every budget.
"""

import math

import networkx as nx
import numpy as np
import osmnx as ox
from pyproj import Transformer
from shapely.geometry import LineString, Point

from config import METRIC_CRS, POI_RADIUS_M, SCORED_GRAPH_PATH, WALK_SPEED_KMH

METRES_PER_MIN = WALK_SPEED_KMH * 1000 / 60
LAMBDAS = np.round(np.arange(0, 5.0001, 0.1), 2)
# Cost floor as a share of edge length: keeps every cost positive, and stops a
# long high-scoring detour from becoming effectively free.
MIN_COST_SHARE = 0.05
VIA_LAMBDAS = [0.0, 0.3, 0.6, 1.0]

_to_metric = Transformer.from_crs("EPSG:4326", METRIC_CRS, always_xy=True)


def load_graph():
    graph = ox.load_graphml(
        SCORED_GRAPH_PATH, edge_dtypes={"poi_score": float, "poi_ids": str}
    )
    for _, _, data in graph.edges(data=True):
        ids = data.get("poi_ids") or ""
        data["poi_set"] = frozenset(ids.split(";")) if ids else frozenset()
    return graph


def calibrate_k(graph):
    """Metres of length one POI weight point is worth at λ = 1: median length / median non-zero score."""
    lengths = [d["length"] for _, _, d in graph.edges(data=True)]
    scores = [d["poi_score"] for _, _, d in graph.edges(data=True) if d["poi_score"] > 0]
    return float(np.median(lengths) / np.median(scores))


def nearest_node(graph, lat, lng):
    best, best_d = None, math.inf
    cos_lat = math.cos(math.radians(lat))
    for node, data in graph.nodes(data=True):
        d = ((data["y"] - lat) ** 2) + ((data["x"] - lng) * cos_lat) ** 2
        if d < best_d:
            best, best_d = node, d
    return best


def scenic_cost(lam, k):
    def cost(data):
        length = data["length"]
        return max(length - lam * data["poi_score"] * k, length * MIN_COST_SHARE, 0.01)

    return cost


def shortest_route(graph, source, target, edge_cost):
    """Shortest path under `edge_cost`; returns the chosen (u, v, key) edges."""

    def weight(u, v, parallel):  # MultiDiGraph: parallel = {key: data}
        return min(edge_cost(d) for d in parallel.values())

    nodes = nx.shortest_path(graph, source, target, weight=weight)
    edges = []
    for u, v in zip(nodes[:-1], nodes[1:]):
        key = min(graph[u][v], key=lambda k: edge_cost(graph[u][v][k]))
        edges.append((u, v, key))
    return edges


def route_coords(graph, edges):
    coords = []
    for u, v, key in edges:
        data = graph.edges[u, v, key]
        if "geometry" in data:
            line = list(data["geometry"].coords)
            ux, uy = graph.nodes[u]["x"], graph.nodes[u]["y"]
            # Make sure the segment runs u -> v.
            if (line[0][0] - ux) ** 2 + (line[0][1] - uy) ** 2 > (line[-1][0] - ux) ** 2 + (line[-1][1] - uy) ** 2:
                line.reverse()
        else:
            line = [(graph.nodes[u]["x"], graph.nodes[u]["y"]), (graph.nodes[v]["x"], graph.nodes[v]["y"])]
        coords.extend(line if not coords else line[1:])
    return [[round(x, 6), round(y, 6)] for x, y in coords]


def summarise(graph, edges, pois_by_id):
    """Route dict: GeoJSON line, distance, duration and unique POIs in walking order."""
    distance = sum(graph.edges[e]["length"] for e in edges)
    coords = route_coords(graph, edges)
    poi_ids = set().union(*(graph.edges[e]["poi_set"] for e in edges)) if edges else set()

    metric_line = LineString([_to_metric.transform(x, y) for x, y in coords])
    along = []
    for pid in poi_ids:
        poi = pois_by_id[pid]
        at = metric_line.project(Point(_to_metric.transform(poi["lng"], poi["lat"])))
        along.append((at, pid))
    along.sort()
    scale = distance / metric_line.length if metric_line.length else 1  # projected vs graph length

    return {
        "geometry": {"type": "LineString", "coordinates": coords},
        "distance_m": round(distance),
        "duration_min": round(distance / METRES_PER_MIN, 1),
        "poi_ids": [pid for _, pid in along],
        "poi_minutes": [round(at * scale / METRES_PER_MIN, 1) for at, _ in along],
        "poi_score": int(sum(pois_by_id[pid]["weight"] for pid in poi_ids)),
    }


def via_routes(graph, source, target, edge_cost, max_length):
    """Yield source -> via -> target paths for every via node, using two Dijkstra trees.

    The λ sweep alone saturates: once λ·score·k exceeds an edge's length every scored
    edge hits the cost floor, so larger λ stops adding detours. Routing through
    via nodes lets bigger budgets reach dense streets further off the direct line.
    """

    def weight(u, v, parallel):
        return min(edge_cost(d) for d in parallel.values())

    _, from_source = nx.single_source_dijkstra(graph, source, weight=weight)
    _, from_target = nx.single_source_dijkstra(graph, target, weight=weight)  # walk graph is bidirectional
    for via, head in from_source.items():
        tail = from_target.get(via)
        if tail is None:
            continue
        nodes = head + tail[::-1][1:]
        if len(set(nodes)) != len(nodes):  # no doubling back
            continue
        edges = [(u, v, min(graph[u][v], key=lambda k: edge_cost(graph[u][v][k]))) for u, v in zip(nodes[:-1], nodes[1:])]
        if sum(graph.edges[e]["length"] for e in edges) <= max_length:
            yield edges


def plan(graph, pois_by_id, source, target, budgets, k):
    """Fastest route plus the best scenic route for each extra-minute budget."""
    fastest_edges = shortest_route(graph, source, target, lambda d: d["length"])
    fastest = summarise(graph, fastest_edges, pois_by_id)
    fastest_m = sum(graph.edges[e]["length"] for e in fastest_edges)
    max_length = fastest_m + max(budgets) * METRES_PER_MIN

    # Candidates: the direct λ sweep, plus via-node routes for a few λ values.
    candidates = {}
    for lam in LAMBDAS:
        edges = shortest_route(graph, source, target, scenic_cost(lam, k))
        candidates.setdefault(tuple(edges), (float(lam), "direct"))
    for lam in VIA_LAMBDAS:
        for edges in via_routes(graph, source, target, scenic_cost(lam, k), max_length):
            candidates.setdefault(tuple(edges), (float(lam), "via"))

    # Cheap scoring for all candidates; full summaries only for the winners.
    scored = []
    for edges, (lam, method) in candidates.items():
        length = sum(graph.edges[e]["length"] for e in edges)
        ids = set().union(*(graph.edges[e]["poi_set"] for e in edges))
        weight = sum(pois_by_id[p]["weight"] for p in ids)
        scored.append((length, len(ids), weight, edges, lam, method))

    scenic = {}
    for budget in budgets:
        limit = fastest_m + budget * METRES_PER_MIN + 1e-6
        feasible = [c for c in scored if c[0] <= limit]
        # Most unique POIs, then highest weighted score, then shortest.
        length, _, _, edges, lam, method = max(feasible, key=lambda c: (c[1], c[2], -c[0]))
        best = summarise(graph, list(edges), pois_by_id)
        scenic[str(budget)] = {
            **best,
            "lambda": lam,
            "method": method,
            "extra_min": round((length - fastest_m) / METRES_PER_MIN, 1),
            "extra_pois": len(best["poi_ids"]) - len(fastest["poi_ids"]),
        }
    return fastest, scenic


def load_pois_by_id():
    import json

    from config import POIS_GEOJSON_PATH

    features = json.loads(POIS_GEOJSON_PATH.read_text())["features"]
    return {f["properties"]["id"]: f["properties"] for f in features}


if __name__ == "__main__":
    graph = load_graph()
    pois_by_id = load_pois_by_id()
    k = calibrate_k(graph)
    print(f"k = {k:.2f} m per weight point (POI radius {POI_RADIUS_M} m, {WALK_SPEED_KMH} km/h)")

    source = nearest_node(graph, 45.4846, 9.1873)  # Milano Porta Garibaldi station
    target = nearest_node(graph, 45.4641, 9.1900)  # Piazza del Duomo
    budgets = [0, 5, 10, 15, 20, 30]
    fastest, scenic = plan(graph, pois_by_id, source, target, budgets, k)

    print("\nPorta Garibaldi -> Duomo")
    print(f"{'route':>10} {'λ':>5} {'dist m':>7} {'min':>6} {'+min':>5} {'POIs':>5} {'+POIs':>6} {'score':>6}")
    print(f"{'fastest':>10} {'':>5} {fastest['distance_m']:>7} {fastest['duration_min']:>6} {'':>5} "
          f"{len(fastest['poi_ids']):>5} {'':>6} {fastest['poi_score']:>6}")
    for budget, s in scenic.items():
        print(f"{'+' + budget + ' min':>10} {s['lambda']:>5} {s['distance_m']:>7} {s['duration_min']:>6} "
              f"{s['extra_min']:>5} {len(s['poi_ids']):>5} {s['extra_pois']:>6} {s['poi_score']:>6}  {s['method']}")

    ten = scenic["10"]
    ratio = len(ten["poi_ids"]) / max(len(fastest["poi_ids"]), 1)
    print(f"\n+10 min passes {ratio:.1f}x the POIs of the fastest route")
    named = [pois_by_id[p] for p in ten["poi_ids"] if pois_by_id[p]["weight"] == 3]
    print("Weight-3 sights on the +10 route:", ", ".join(p["name"] for p in named[:15]))
