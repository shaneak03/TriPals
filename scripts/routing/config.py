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

BUDGETS_MIN = [0, 5, 10, 15, 20, 30]

# Named places (lat, lng) at the spot a walker would start or finish.
PLACES = {
    "garibaldi-station": ("Hotel by Porta Garibaldi station", 45.4846, 9.1873),
    "porta-garibaldi": ("Porta Garibaldi", 45.4801, 9.1875),
    "duomo": ("Duomo di Milano", 45.4641, 9.1900),
    "brera-academy": ("Brera Academy", 45.4719, 9.1879),
    "pinacoteca-brera": ("Pinacoteca di Brera", 45.4721, 9.1881),
    "castello": ("Castello Sforzesco", 45.4695, 9.1795),
    "galleria": ("Galleria Vittorio Emanuele II", 45.4655, 9.1900),
    "navigli": ("Navigli (Darsena)", 45.4525, 9.1765),
}

# Preset walks: (pair id, start place, end place). The first is the main demo pair.
PAIRS = [
    ("garibaldi-duomo", "garibaldi-station", "duomo"),
    ("brera-castello", "brera-academy", "castello"),
    ("duomo-navigli", "duomo", "navigli"),
    ("castello-galleria", "castello", "galleria"),
    ("garibaldi-pinacoteca", "porta-garibaldi", "pinacoteca-brera"),
]
MAIN_PAIR = "garibaldi-duomo"
