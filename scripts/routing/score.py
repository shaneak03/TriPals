"""Step 2: score every street segment by the points of interest along it.

Each edge of the walk graph gets:
  poi_ids   – ids of POIs within POI_RADIUS_M of the edge geometry (";"-joined, GraphML stores strings)
  poi_score – sum of those POIs' weights, each POI counted once per edge
"""

import argparse

import geopandas as gpd
import osmnx as ox

from config import METRIC_CRS, POI_RADIUS_M, graph_path, pois_cache_path, scored_graph_path


def score_edges(graph, pois):
    edges = ox.graph_to_gdfs(graph, nodes=False, fill_edge_geometry=True).to_crs(METRIC_CRS)
    edges = edges.reset_index()[["u", "v", "key", "name", "length", "geometry"]]

    # Polygons (parks, the Duomo…) count when the street passes within the radius of their outline.
    zones = pois[["id", "weight", "geometry"]].copy()
    zones["geometry"] = zones.geometry.buffer(POI_RADIUS_M)
    hits = gpd.sjoin(edges[["u", "v", "key", "geometry"]], zones, predicate="intersects")
    hits = hits.drop_duplicates(["u", "v", "key", "id"])

    per_edge = hits.groupby(["u", "v", "key"]).agg(
        poi_ids=("id", lambda ids: ";".join(sorted(ids))),
        poi_score=("weight", "sum"),
    )
    edges = edges.merge(per_edge, on=["u", "v", "key"], how="left")
    edges["poi_ids"] = edges["poi_ids"].fillna("")
    edges["poi_score"] = edges["poi_score"].fillna(0).astype(float)

    for row in edges.itertuples():
        data = graph.edges[row.u, row.v, row.key]
        data["poi_ids"] = row.poi_ids
        data["poi_score"] = row.poi_score
    return edges, hits


def street_name(name):
    if isinstance(name, list):
        return " / ".join(name)
    return name if isinstance(name, str) else None


def print_summary(edges, hits, pois):
    # The walk graph has one edge per direction; count each street segment once.
    segments = edges.assign(pair=edges.apply(lambda r: (min(r.u, r.v), max(r.u, r.v), r.key), axis=1))
    segments = segments.drop_duplicates("pair")
    scored = segments[segments.poi_score > 0]
    print(f"\nStreet segments: {len(segments):,}")
    print(f"  with poi_score > 0: {len(scored):,} ({len(scored) / len(segments):.0%})")
    print(f"  poi_score among scored: median {scored.poi_score.median():.0f}, "
          f"p90 {scored.poi_score.quantile(0.9):.0f}, max {scored.poi_score.max():.0f}")
    print(f"  edge length: median {segments.length.median():.0f} m")
    print(f"  POIs near at least one street: {hits.id.nunique():,} / {len(pois):,}")

    # Whole streets: unique POIs along all segments sharing a name.
    named = hits.merge(edges[["u", "v", "key", "name"]], on=["u", "v", "key"])
    named["street"] = named["name"].map(street_name)
    named = named.dropna(subset=["street"]).drop_duplicates(["street", "id"])
    lengths = segments.assign(street=segments["name"].map(street_name)).groupby("street")["length"].sum()
    weights = pois.set_index("id")["weight"]
    streets = named.groupby("street").agg(score=("weight", "sum"), pois=("id", "nunique"))
    streets["length_m"] = lengths.reindex(streets.index).round()
    streets["sights_3pt"] = named[named["id"].map(weights) == 3].groupby("street")["id"].nunique()
    streets = streets.fillna({"sights_3pt": 0}).astype({"sights_3pt": int})
    print("\nTop 10 streets by score (unique POIs within 30 m of the whole street):")
    print(streets.sort_values("score", ascending=False).head(10).to_string())

    print("\nTop 10 single segments by score per 100 m (segments ≥ 40 m):")
    dense = scored[scored.length >= 40].assign(per_100m=lambda d: (d.poi_score / d.length * 100).round(1))
    dense = dense.assign(street=dense["name"].map(street_name).fillna("(unnamed path)"))
    print(dense.sort_values("per_100m", ascending=False)
          .head(10)[["street", "length", "poi_score", "per_100m"]].round(0).to_string(index=False))


def main(city_id: str, summary: bool = True):
    graph = ox.load_graphml(graph_path(city_id))
    pois = gpd.read_file(pois_cache_path(city_id)).to_crs(METRIC_CRS)
    edges, hits = score_edges(graph, pois)
    ox.save_graphml(graph, scored_graph_path(city_id))
    print(f"Scored {len(edges):,} directed edges -> {scored_graph_path(city_id).name}")
    if summary:
        print_summary(edges, hits, pois)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--city", default="milan")
    main(parser.parse_args().city)
