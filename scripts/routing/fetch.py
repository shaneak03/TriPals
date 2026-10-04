"""Step 1: download a city's walk network and named points of interest from OSM.

The bbox and POI categories (OSM tags + weights) come from Supabase. Writes the raw
graph, POI geometries and a POI point GeoJSON to cache/<city>/.
"""

import argparse
import json

import geopandas as gpd
import osmnx as ox
import pandas as pd

from config import (
    BUFFER_DEG,
    CACHE_DIR,
    DEDUPE_RADIUS_M,
    METRIC_CRS,
    graph_path,
    pois_cache_path,
    pois_geojson_path,
)
from db import Category, CityConfig, load_city


def setup_osmnx():
    ox.settings.use_cache = True
    ox.settings.cache_folder = str(CACHE_DIR / "http")


def fetch_graph(city: CityConfig):
    print("Downloading walk network…")
    w, s, e, n = city.bbox
    buffered = (w - BUFFER_DEG, s - BUFFER_DEG, e + BUFFER_DEG, n + BUFFER_DEG)
    graph = ox.graph_from_bbox(buffered, network_type="walk", truncate_by_edge=True)
    path = graph_path(city.id)
    path.parent.mkdir(parents=True, exist_ok=True)
    ox.save_graphml(graph, path)
    print(f"  {graph.number_of_nodes():,} nodes, {graph.number_of_edges():,} edges -> {path.relative_to(CACHE_DIR)}")


def matches(category: Category, row) -> bool:
    for key, values in category.osm_tags.items():
        value = row.get(key)
        if not isinstance(value, str) or value == "no":
            continue
        if values == "*" or value in values:
            return True
    return False


def classify(row, categories: list[Category]):
    """(category id, weight) of the highest-weight category the feature matches."""
    for category in categories:  # sorted highest weight first
        if matches(category, row):
            return category.id, category.weight
    return None, 0


def overpass_tags(categories: list[Category]) -> dict:
    tags = {}
    for category in categories:
        for key, values in category.osm_tags.items():
            if values == "*":
                tags[key] = True
            elif tags.get(key) is not True:
                tags[key] = sorted(set(tags.get(key, [])) | set(values))
    return tags


def fetch_pois(city: CityConfig):
    print("Downloading points of interest…")
    raw = ox.features_from_bbox(city.bbox, overpass_tags(city.categories)).reset_index()
    print(f"  {len(raw):,} raw features")

    raw = raw[raw["name"].notna() & (raw["name"].str.strip() != "")]
    classified = raw.apply(classify, axis=1, result_type="expand", categories=city.categories)
    raw["category"], raw["weight"] = classified[0], classified[1]
    pois = raw[raw["weight"] > 0].copy()
    pois["id"] = pois["element"] + "/" + pois["id"].astype(str)
    pois["name"] = pois["name"].str.strip()
    pois = gpd.GeoDataFrame(pois[["id", "name", "category", "weight", "geometry"]], crs=raw.crs)
    print(f"  {len(pois):,} named POIs before dedupe")

    pois = dedupe(pois.to_crs(METRIC_CRS))
    print(f"  {len(pois):,} after removing same-name duplicates within {DEDUPE_RADIUS_M} m")

    pois.to_file(pois_cache_path(city.id), driver="GPKG")
    write_geojson(city.id, pois)


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


def write_geojson(city_id, pois):
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
    path = pois_geojson_path(city_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False))
    counts = pd.Series([f["properties"]["category"] for f in features]).value_counts()
    print(f"  wrote {len(features):,} POIs -> {path.relative_to(CACHE_DIR)}")
    print(counts.to_string())


def main(city_id: str):
    city = load_city(city_id)
    setup_osmnx()
    fetch_graph(city)
    fetch_pois(city)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--city", default="milan")
    main(parser.parse_args().city)
