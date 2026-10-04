"""Fastest vs "most to see" walking routes on a city's scored walk graph."""

import json
import pickle
from dataclasses import dataclass

import networkx as nx
import numpy as np
from pyproj import Transformer
from scipy.spatial import cKDTree
from shapely.geometry import LineString, Point

from .config import WALK_SPEED_KMH, pois_geojson_path, scored_graph_path, slim_graph_path

METRES_PER_MIN = WALK_SPEED_KMH * 1000 / 60
# Beyond λ≈1.5 every scored edge sits on the cost floor and the sweep only repeats
# routes (0 of 30 preset routes changed when capping 5.0 -> 1.5); 2.0 keeps a margin.
LAMBDAS = np.round(np.arange(0, 2.0001, 0.1), 2)
# Cost floor as a share of edge length: keeps every cost positive, and stops a
# long high-scoring detour from becoming effectively free.
MIN_COST_SHARE = 0.05
VIA_LAMBDAS = [0.0, 0.3, 0.6, 1.0]
EMPTY = frozenset()


@dataclass
class CityGraph:
    """A city's scored walk graph, loaded once and kept in memory."""

    city_id: str
    graph: nx.MultiDiGraph
    pois_by_id: dict
    k: float  # metres of length one POI weight point is worth at λ = 1
    to_metric: Transformer
    node_ids: np.ndarray
    node_xy: np.ndarray  # metric coordinates, aligned with node_ids
    tree: cKDTree

    def nearest_node(self, lat: float, lng: float):
        """(node id, snap distance in metres) of the closest walkable node."""
        dist, i = self.tree.query(self.to_metric.transform(lng, lat))
        return self.node_ids[i], float(dist)

    def node_xy_of(self, node):
        data = self.graph.nodes[node]
        return np.array(self.to_metric.transform(data["x"], data["y"]))


def load_graph(city_id):
    """Load the scored GraphML, keeping only what routing needs."""
    import osmnx as ox  # heavy; only needed when (re)building the slim cache

    graph = ox.load_graphml(scored_graph_path(city_id), edge_dtypes={"poi_score": float, "poi_ids": str})
    for _, _, data in graph.edges(data=True):
        ids = data.get("poi_ids") or ""
        geometry = data.get("geometry")
        slim = {
            "length": float(data["length"]),
            "poi_score": float(data["poi_score"]),
            "poi_set": frozenset(ids.split(";")) if ids else EMPTY,
        }
        if geometry is not None:
            slim["coords"] = tuple(geometry.coords)
        data.clear()
        data.update(slim)
    for _, data in graph.nodes(data=True):
        x, y = data["x"], data["y"]
        data.clear()
        data.update(x=x, y=y)
    return graph


def write_slim_graph(city_id):
    """Cache the routing-only graph + POIs as a pickle (≈9 MB for Milan).

    Parsing GraphML leaves ~320 MB resident even after the graph is slimmed; loading
    this pickle takes ~0.1 s and ~80 MB, which is what lets the API fit a small server.
    """
    path = slim_graph_path(city_id)
    with path.open("wb") as f:
        pickle.dump((load_graph(city_id), load_pois_by_id(city_id)), f, protocol=pickle.HIGHEST_PROTOCOL)
    return path


def load_city_graph(city) -> "CityGraph":
    path = slim_graph_path(city.id)
    if not path.exists():
        write_slim_graph(city.id)
    with path.open("rb") as f:
        graph, pois_by_id = pickle.load(f)  # our own cache file, written by write_slim_graph
    to_metric = Transformer.from_crs("EPSG:4326", city.crs, always_xy=True)
    node_ids = np.array(list(graph.nodes))
    lng = np.array([graph.nodes[n]["x"] for n in node_ids])
    lat = np.array([graph.nodes[n]["y"] for n in node_ids])
    node_xy = np.column_stack(to_metric.transform(lng, lat))
    return CityGraph(city.id, graph, pois_by_id, calibrate_k(graph), to_metric, node_ids, node_xy, cKDTree(node_xy))


def calibrate_k(graph):
    """Metres of length one POI weight point is worth at λ = 1: median length / median non-zero score."""
    lengths = [d["length"] for _, _, d in graph.edges(data=True)]
    scores = [d["poi_score"] for _, _, d in graph.edges(data=True) if d["poi_score"] > 0]
    return float(np.median(lengths) / np.median(scores))


def scenic_cost(lam, k):
    def cost(data):
        length = data["length"]
        return max(length - lam * data["poi_score"] * k, length * MIN_COST_SHARE, 0.01)

    return cost


def restricted(edge_cost, allowed):
    """networkx weight function: `edge_cost` on edges inside `allowed`, hidden (None) elsewhere."""

    def weight(u, v, parallel):  # MultiDiGraph: parallel = {key: data}
        if allowed is not None and v not in allowed:
            return None
        return min(edge_cost(d) for d in parallel.values())

    return weight


def shortest_route(graph, source, target, edge_cost, allowed=None):
    """Shortest path under `edge_cost`; returns the chosen (u, v, key) edges."""
    _, nodes = nx.bidirectional_dijkstra(graph, source, target, weight=restricted(edge_cost, allowed))
    edges = []
    for u, v in zip(nodes[:-1], nodes[1:]):
        key = min(graph[u][v], key=lambda k: edge_cost(graph[u][v][k]))
        edges.append((u, v, key))
    return edges


def route_coords(graph, edges):
    coords = []
    for u, v, key in edges:
        data = graph.edges[u, v, key]
        if "coords" in data:
            line = list(data["coords"])
            ux, uy = graph.nodes[u]["x"], graph.nodes[u]["y"]
            # Make sure the segment runs u -> v.
            if (line[0][0] - ux) ** 2 + (line[0][1] - uy) ** 2 > (line[-1][0] - ux) ** 2 + (line[-1][1] - uy) ** 2:
                line.reverse()
        else:
            line = [(graph.nodes[u]["x"], graph.nodes[u]["y"]), (graph.nodes[v]["x"], graph.nodes[v]["y"])]
        coords.extend(line if not coords else line[1:])
    return [[round(x, 6), round(y, 6)] for x, y in coords]


def summarise(cg: CityGraph, edges):
    """Route dict: GeoJSON line, distance, duration and unique POIs in walking order."""
    graph, pois_by_id = cg.graph, cg.pois_by_id
    distance = sum(graph.edges[e]["length"] for e in edges)
    coords = route_coords(graph, edges)
    poi_ids = set().union(*(graph.edges[e]["poi_set"] for e in edges)) if edges else set()

    metric_line = LineString([cg.to_metric.transform(x, y) for x, y in coords])
    along = []
    for pid in poi_ids:
        poi = pois_by_id[pid]
        at = metric_line.project(Point(cg.to_metric.transform(poi["lng"], poi["lat"])))
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
        "sights": sum(1 for pid in poi_ids if pois_by_id[pid].get("highlighted")),  # what the map pins
    }


def _cheapest_key(graph, u, v, edge_cost):
    parallel = graph[u][v]
    return min(parallel, key=lambda kk: edge_cost(parallel[kk]))


def _tree(graph, root, edge_cost, allowed):
    """Cost-optimal search tree from root, computed once per tree instead of per candidate.

    Per reached node: parent, the edge key parent -> node, the key node -> parent (for
    walking the tree backwards) and the true walked metres along the tree from root.
    """
    pred, dist = nx.dijkstra_predecessor_and_distance(graph, root, weight=restricted(edge_cost, allowed))
    parent, key, back_key, metres = {root: None}, {}, {}, {root: 0.0}
    for node in sorted(dist, key=dist.get):  # parents are settled before children
        if node == root:
            continue
        p = pred[node][0]
        k = _cheapest_key(graph, p, node, edge_cost)
        parent[node], key[node] = p, k
        back_key[node] = _cheapest_key(graph, node, p, edge_cost) if graph.has_edge(node, p) else None
        metres[node] = metres[p] + graph[p][node][k]["length"]
    return parent, key, back_key, metres


def _path_edges(parent, key, node):
    """Edges root -> node along a search tree."""
    edges = []
    while parent[node] is not None:
        edges.append((parent[node], node, key[node]))
        node = parent[node]
    edges.reverse()
    return edges


def via_routes(graph, source, target, edge_cost, max_length, allowed=None):
    """Yield source -> via -> target routes (no doubling back) no longer than max_length.

    The λ sweep alone saturates: once λ·score·k exceeds an edge's length every scored
    edge hits the cost floor, so larger λ stops adding detours. Routing through
    via nodes lets bigger budgets reach dense streets further off the direct line.
    Lengths come from the two search trees, so paths are only built for vias that fit.
    """
    s_parent, s_key, _, s_m = _tree(graph, source, edge_cost, allowed)
    t_parent, _, t_back, t_m = _tree(graph, target, edge_cost, allowed)  # walk graph is bidirectional
    for via, head_m in s_m.items():
        tail_m = t_m.get(via)
        if tail_m is None or head_m + tail_m > max_length:
            continue
        if via not in (source, target) and s_parent[via] == t_parent[via]:
            continue  # arrives and leaves along the same street: a U-turn at the via node
        head = _path_edges(s_parent, s_key, via)
        # The target tree runs target -> via; walk it backwards as via -> target.
        tail, node = [], via
        while t_parent[node] is not None:
            if t_back[node] is None:  # one-way the wrong direction (rare on a walk graph)
                break
            tail.append((node, t_parent[node], t_back[node]))
            node = t_parent[node]
        if node != target:
            continue
        nodes = [source] + [v for _, v, _ in head] + [v for _, v, _ in tail]
        if len(set(nodes)) != len(nodes):  # no doubling back
            continue
        yield head + tail


def reachable_nodes(cg: CityGraph, source, target, max_length):
    """Nodes that can lie on a walk of at most max_length metres from source to target.

    Walking distance is never shorter than the straight line, so a node n can only be
    on such a walk if |source n| + |n target| <= max_length (an ellipse). Restricting
    the searches to it gives the same routes as the whole graph, much faster.
    """
    s_xy, t_xy = cg.node_xy_of(source), cg.node_xy_of(target)
    span = np.hypot(*(cg.node_xy - s_xy).T) + np.hypot(*(cg.node_xy - t_xy).T)
    return set(cg.node_ids[span <= max_length].tolist())


def plan(cg: CityGraph, source, target, budgets):
    """Fastest route plus the best scenic route for each extra-minute budget."""
    graph, pois_by_id, k = cg.graph, cg.pois_by_id, cg.k
    fastest_edges = shortest_route(graph, source, target, lambda d: d["length"])
    fastest = summarise(cg, fastest_edges)
    fastest_m = sum(graph.edges[e]["length"] for e in fastest_edges)
    max_length = fastest_m + max(budgets) * METRES_PER_MIN
    allowed = reachable_nodes(cg, source, target, max_length + 1)

    # Candidates: the direct λ sweep, plus via-node routes for a few λ values.
    candidates = {}
    for lam in LAMBDAS:
        edges = shortest_route(graph, source, target, scenic_cost(lam, k), allowed)
        candidates.setdefault(tuple(edges), (float(lam), "direct"))
    for lam in VIA_LAMBDAS:
        for edges in via_routes(graph, source, target, scenic_cost(lam, k), max_length, allowed):
            candidates.setdefault(tuple(edges), (float(lam), "via"))

    # Cheap scoring for all candidates; full summaries only for the winners.
    scored = []
    for edges, (lam, method) in candidates.items():
        length = sum(graph.edges[e]["length"] for e in edges)
        ids = set().union(*(graph.edges[e]["poi_set"] for e in edges))
        weight = sum(pois_by_id[p]["weight"] for p in ids)
        sights = sum(pois_by_id[p]["weight"] for p in ids if pois_by_id[p].get("highlighted"))
        scored.append((length, len(ids), weight, sights, edges, lam, method))

    scenic, summaries = {}, {}
    for budget in budgets:
        limit = fastest_m + budget * METRES_PER_MIN + 1e-6
        feasible = [c for c in scored if c[0] <= limit]
        # Streets are scored with every category (lively café/shop streets pull the
        # route), but the winner is the candidate passing the most highlighted sights
        # (weighted), then the highest overall score, then the shortest.
        length, _, _, _, edges, lam, method = max(feasible, key=lambda c: (c[3], c[2], -c[0]))
        if edges not in summaries:  # budgets often share a winner
            summaries[edges] = summarise(cg, list(edges))
        best = summaries[edges]
        scenic[str(budget)] = {
            **best,
            "lambda": lam,
            "method": method,
            "extra_min": round((length - fastest_m) / METRES_PER_MIN, 1),
            "extra_pois": len(best["poi_ids"]) - len(fastest["poi_ids"]),
        }
    return fastest, scenic


def load_pois_by_id(city_id):
    features = json.loads(pois_geojson_path(city_id).read_text())["features"]
    return {f["properties"]["id"]: f["properties"] for f in features}
