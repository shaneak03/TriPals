"""Pipeline constants and file locations. City data (bbox, categories, places,
route pairs, time budgets) lives in Supabase; see db.py."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]  # repo root (when installed editable)
# OSM downloads, scored graphs and POI files, shared by the pipeline and the routing API.
# Gitignored. Override with WALKROUTE_CACHE_DIR (e.g. on a server or in Docker).
CACHE_DIR = Path(os.environ.get("WALKROUTE_CACHE_DIR") or ROOT / ".cache" / "walkroute")
DATA_DIR = ROOT / "public" / "data"  # only the static fallback for /walks (run_pipeline --export-fallback)


def graph_path(city_id: str) -> Path:
    return CACHE_DIR / city_id / "walk.graphml"


def scored_graph_path(city_id: str) -> Path:
    return CACHE_DIR / city_id / "walk_scored.graphml"


def pois_cache_path(city_id: str) -> Path:
    return CACHE_DIR / city_id / "pois.gpkg"  # full geometries, used for scoring


def pois_geojson_path(city_id: str) -> Path:
    return CACHE_DIR / city_id / "pois.geojson"  # points, with category, weight and highlighted


def slim_graph_path(city_id: str) -> Path:
    return CACHE_DIR / city_id / "walk_slim.pkl"  # routing-only graph + POIs, fast and small to load


def inputs_stamp_path(city_id: str) -> Path:
    return CACHE_DIR / city_id / "inputs.sha256"


def utm_crs(lng: float, lat: float) -> str:
    """Metric CRS for distances and buffers: the UTM zone containing the point."""
    zone = int((lng + 180) // 6) + 1
    return f"EPSG:{32600 + zone if lat >= 0 else 32700 + zone}"


# Extra margin when downloading so streets crossing the bbox edge are complete.
BUFFER_DEG = 0.003  # ~300 m

WALK_SPEED_KMH = 4.8
POI_RADIUS_M = 30
DEDUPE_RADIUS_M = 15
