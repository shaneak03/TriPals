"""Shared settings for the Milan walk-routing pipeline."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = Path(__file__).resolve().parent / "cache"  # raw OSM downloads, gitignored
DATA_DIR = ROOT / "public" / "data"
ROUTES_DIR = DATA_DIR / "routes"

GRAPH_PATH = CACHE_DIR / "milan_walk.graphml"
SCORED_GRAPH_PATH = CACHE_DIR / "milan_walk_scored.graphml"
POIS_CACHE_PATH = CACHE_DIR / "milan_pois.gpkg"  # full geometries, used for scoring
POIS_GEOJSON_PATH = DATA_DIR / "milan_pois.geojson"  # points, shipped to the frontend

# Porta Garibaldi, Brera and the Duomo, extended south to the Darsena (Navigli).
# (west, south, east, north) — the order osmnx 2.x expects.
BBOX = (9.170, 45.448, 9.200, 45.490)
# Extra margin when downloading so streets crossing the bbox edge are complete.
BUFFER_DEG = 0.003  # ~300 m

METRIC_CRS = "EPSG:32632"  # UTM 32N, metres
WALK_SPEED_KMH = 4.8
POI_RADIUS_M = 30
DEDUPE_RADIUS_M = 15

# (OSM key, accepted values or True for any) -> weight. When a feature matches
# several rules, the highest weight wins.
POI_RULES = [
    ("tourism", ["attraction", "museum", "gallery", "viewpoint", "artwork"], 3),
    ("historic", True, 3),
    ("amenity", ["place_of_worship", "fountain"], 2),
    ("leisure", ["park", "garden"], 2),
    ("amenity", ["cafe", "restaurant", "bar"], 1),
    ("shop", True, 1),
]
