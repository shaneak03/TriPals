import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def _csv(name: str, default: str = "") -> list[str]:
    return [v.strip() for v in os.environ.get(name, default).split(",") if v.strip()]


ROUTING_CITIES = _csv("ROUTING_CITIES")  # empty = every active city
ALLOWED_ORIGINS = _csv("ALLOWED_ORIGINS", "http://localhost:3000")
MAX_STRAIGHT_LINE_M = 6000  # longer walks are rejected
MAX_SNAP_M = 250  # how far a point may be from the nearest walkable street
CITY_MARGIN_DEG = 0.003  # the walk graph is downloaded with this buffer around the bbox
CACHE_TTL_DAYS = 30
CELL_M = 20  # route_cache grid size
