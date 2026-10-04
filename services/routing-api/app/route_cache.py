"""route_cache table: full all-budgets responses keyed by city + ~20 m start/end cells."""

import logging
import math
from datetime import datetime, timedelta, timezone

from walkroute import db

from . import settings
from .cities import LoadedCity

log = logging.getLogger("routing-api")
METRES_PER_DEG = 111_320


def cell(city: LoadedCity, lat: float, lng: float) -> tuple[int, int]:
    """(y, x) index of the ~20 m grid cell containing the point."""
    cos_lat = math.cos(math.radians(city.config.centre[1]))
    return round(lat * METRES_PER_DEG / settings.CELL_M), round(lng * METRES_PER_DEG * cos_lat / settings.CELL_M)


def _key(city: LoadedCity, start: tuple[float, float], end: tuple[float, float]) -> dict:
    (fy, fx), (ty, tx) = cell(city, *start), cell(city, *end)
    return {"city_id": city.config.id, "inputs_hash": city.inputs_hash, "from_y": fy, "from_x": fx, "to_y": ty, "to_x": tx}


def get(city: LoadedCity, start, end) -> dict | None:
    fresh_after = (datetime.now(timezone.utc) - timedelta(days=settings.CACHE_TTL_DAYS)).isoformat()
    try:
        query = db.client().table("route_cache").select("response")
        for column, value in _key(city, start, end).items():
            query = query.eq(column, value)
        rows = query.gt("computed_at", fresh_after).limit(1).execute().data
        return rows[0]["response"] if rows else None
    except Exception:  # the cache is an optimisation; never fail a request over it
        log.exception("route_cache read failed")
        return None


def put(city: LoadedCity, start, end, response: dict) -> None:
    row = {**_key(city, start, end), "response": response, "computed_at": datetime.now(timezone.utc).isoformat()}
    try:
        db.client().table("route_cache").upsert(row, on_conflict="city_id,inputs_hash,from_y,from_x,to_y,to_x").execute()
    except Exception:
        log.exception("route_cache write failed")


def prune() -> None:
    """Drop entries past their TTL (run at startup)."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=settings.CACHE_TTL_DAYS)).isoformat()
    try:
        db.client().table("route_cache").delete().lt("computed_at", cutoff).execute()
    except Exception:
        log.exception("route_cache prune failed")
