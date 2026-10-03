"""Step 1: download the Milan walk network and named points of interest from OSM.

Writes the raw graph and POI geometries to cache/ and a point GeoJSON to public/data/.
"""

import json

import geopandas as gpd
import osmnx as ox
import pandas as pd

from config import (
    BBOX,
    BUFFER_DEG,
    CACHE_DIR,
    DEDUPE_RADIUS_M,
    GRAPH_PATH,
    METRIC_CRS,
    POI_RULES,
    POIS_CACHE_PATH,
    POIS_GEOJSON_PATH,
)


def buffered_bbox():
    w, s, e, n = BBOX
    return (w - BUFFER_DEG, s - BUFFER_DEG, e + BUFFER_DEG, n + BUFFER_DEG)


def fetch_graph():
    print("Downloading walk network…")
    graph = ox.graph_from_bbox(buffered_bbox(), network_type="walk", truncate_by_edge=True)
    ox.save_graphml(graph, GRAPH_PATH)
    print(f"  {graph.number_of_nodes():,} nodes, {graph.number_of_edges():,} edges -> {GRAPH_PATH.name}")


def classify(row):
    """Return (category, weight) for the highest-weight rule the feature matches."""
    for key, values, weight in POI_RULES:  # rules are ordered by weight, highest first
        value = row.get(key)
        if not isinstance(value, str) or value == "no":
            continue
        if values is True or value in values:
            # Keys matched on any value collapse to the key itself ("historic", "shop").
            return (key if values is True else value), weight
    return None, 0


def fetch_pois():
    print("Downloading points of interest…")
    tags = {}
    for key, values, _ in POI_RULES:
        if values is True:
            tags[key] = True
        elif tags.get(key) is not True:
            tags[key] = sorted(set(tags.get(key, [])) | set(values))

    raw = ox.features_from_bbox(BBOX, tags).reset_index()
    print(f"  {len(raw):,} raw features")

    raw = raw[raw["name"].notna() & (raw["name"].str.strip() != "")]
    classified = raw.apply(classify, axis=1, result_type="expand")
    raw["category"], raw["weight"] = classified[0], classified[1]
    pois = raw[raw["weight"] > 0].copy()
    pois["id"] = pois["element"] + "/" + pois["id"].astype(str)
    pois["name"] = pois["name"].str.strip()
    pois = gpd.GeoDataFrame(pois[["id", "name", "category", "weight", "geometry"]], crs=raw.crs)
    print(f"  {len(pois):,} named POIs before dedupe")

    pois = dedupe(pois.to_crs(METRIC_CRS))
    print(f"  {len(pois):,} after removing same-name duplicates within {DEDUPE_RADIUS_M} m")

    pois.to_file(POIS_CACHE_PATH, driver="GPKG")
    write_geojson(pois)


def dedupe(pois):
    """Drop POIs with the same name as an already-kept POI less than DEDUPE_RADIUS_M away.

    Higher-weight features are kept first, so e.g. a museum beats a same-named shop.
    """
    pois = pois.sort_values(["weight", "id"], ascending=[False, True])
    kept = []
    for _, group in pois.groupby("name", sort=False):
        survivors = []
        for idx, row in group.iterrows():
            if all(row.geometry.distance(group.at[s, "geometry"]) >= DEDUPE_RADIUS_M for s in survivors):
                survivors.append(idx)
        kept.extend(survivors)
    return pois.loc[kept].sort_values("id")


def write_geojson(pois):
    points = pois.copy()
    points["geometry"] = points.geometry.representative_point()
    points = points.to_crs("EPSG:4326")
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(p.geometry.x, 6), round(p.geometry.y, 6)]},
            "properties": {
                "id": p.id,
                "name": p.name,
                "category": p.category,
                "weight": int(p.weight),
                "lat": round(p.geometry.y, 6),
                "lng": round(p.geometry.x, 6),
            },
        }
        for p in points.itertuples()
    ]
    POIS_GEOJSON_PATH.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False))
    counts = pd.Series([f["properties"]["category"] for f in features]).value_counts()
    print(f"  wrote {len(features):,} POIs -> {POIS_GEOJSON_PATH.relative_to(POIS_GEOJSON_PATH.parents[2])}")
    print(counts.to_string())


if __name__ == "__main__":
    CACHE_DIR.mkdir(exist_ok=True)
    POIS_GEOJSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    ox.settings.use_cache = True
    ox.settings.cache_folder = str(CACHE_DIR / "http")
    fetch_graph()
    fetch_pois()
