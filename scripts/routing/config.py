"""Pipeline constants and file locations. City data (bbox, categories, places,
route pairs, time budgets) lives in Supabase; see db.py."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = Path(__file__).resolve().parent / "cache"  # raw OSM downloads, gitignored
DATA_DIR = ROOT / "public" / "data"  # only the static fallback for /walks (see run_pipeline --export-fallback)


def graph_path(city_id: str) -> Path:
    return CACHE_DIR / city_id / "walk.graphml"


def scored_graph_path(city_id: str) -> Path:
    return CACHE_DIR / city_id / "walk_scored.graphml"


def pois_cache_path(city_id: str) -> Path:
    return CACHE_DIR / city_id / "pois.gpkg"  # full geometries, used for scoring


def pois_geojson_path(city_id: str) -> Path:
    return CACHE_DIR / city_id / "pois.geojson"  # points; the pipeline upserts these into Supabase


# Extra margin when downloading so streets crossing the bbox edge are complete.
BUFFER_DEG = 0.003  # ~300 m

METRIC_CRS = "EPSG:32632"  # UTM 32N, metres (fine for Milan; change per city if needed)
WALK_SPEED_KMH = 4.8
POI_RADIUS_M = 30
DEDUPE_RADIUS_M = 15
