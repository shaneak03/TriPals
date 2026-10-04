"""TriPals routing API: fastest vs "most to see" walks between any two points in a loaded city.

  GET /route?from_lat&from_lng&to_lat&to_lng[&budget_min][&from_name][&to_name]
  GET /cities   loaded cities (the frontend shows live routing only for these)
  GET /health
"""

import logging
import math
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from walkroute.routing import plan

from . import route_cache, settings
from .cities import LoadedCity, load_cities

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("routing-api")

CITIES: dict[str, LoadedCity] = {}
# Routing is CPU-bound Python; one at a time keeps memory flat and avoids two requests
# computing the same uncached route side by side.
COMPUTE_LOCK = threading.Lock()
ROUTE_FIELDS = ("geometry", "distance_m", "duration_min", "extra_min", "extra_pois", "poi_score", "poi_ids", "poi_minutes")


@asynccontextmanager
async def lifespan(_: FastAPI):
    CITIES.update(load_cities())
    if not CITIES:
        log.error("No cities loaded; every /route request will 404.")
    route_cache.prune()
    yield


app = FastAPI(title="TriPals routing API", version="1.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)  # route JSON compresses ~4x
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "cities": sorted(CITIES)}


@app.get("/cities")
def cities():
    return {
        "cities": [
            {"id": c.config.id, "name": c.config.name, "bbox": c.config.bbox, "centre": c.config.centre,
             "budgets": c.config.budgets}
            for c in CITIES.values()
        ]
    }


def haversine_m(lat1, lng1, lat2, lng2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(a))


def find_city(lat_a, lng_a, lat_b, lng_b) -> LoadedCity:
    for city in CITIES.values():
        if city.contains(lat_a, lng_a) and city.contains(lat_b, lng_b):
            return city
    names = ", ".join(c.config.name for c in CITIES.values()) or "no cities"
    if any(c.contains(lat_a, lng_a) or c.contains(lat_b, lng_b) for c in CITIES.values()):
        raise HTTPException(404, f"Start and destination need to be in the same city area. Live routing covers {names}.")
    raise HTTPException(404, f"We don't have live walking routes there yet. Live routing covers {names}.")


def compute(city: LoadedCity, start, end) -> dict:
    """Fastest + every budget's scenic route, in the shape the /walks page uses."""
    cg = city.graph
    source, snap_a = cg.nearest_node(*start)
    target, snap_b = cg.nearest_node(*end)
    if snap_a > settings.MAX_SNAP_M:
        raise HTTPException(422, "We couldn't find a walkable street near your start. Try a point closer to a street.")
    if snap_b > settings.MAX_SNAP_M:
        raise HTTPException(422, "We couldn't find a walkable street near your destination. Try a point closer to a street.")
    if source == target:
        raise HTTPException(422, "Start and destination are too close together. Pick places a little further apart.")

    fastest, scenic = plan(cg, source, target, city.config.budgets)
    used = set(fastest["poi_ids"]).union(*(s["poi_ids"] for s in scenic.values()))
    pois = []
    for pid in sorted(used):
        poi = cg.pois_by_id[pid]
        category = city.categories.get(poi["category"])
        pois.append({
            "id": pid, "name": poi["name"], "category": poi["category"],
            "category_label": category.label if category else poi["category"],
            "icon": category.icon if category else "MapPin",
            "weight": poi["weight"], "highlighted": bool(poi.get("highlighted")),
            "lat": poi["lat"], "lng": poi["lng"],
        })
    pick = lambda r: {k: r.get(k) for k in ROUTE_FIELDS}  # noqa: E731
    return {
        "fastest": {**pick(fastest), "extra_min": None, "extra_pois": None},
        "scenic": {b: pick(r) for b, r in scenic.items()},
        "pois": pois,
    }


@app.get("/route")
def route(
    from_lat: float = Query(ge=-90, le=90),
    from_lng: float = Query(ge=-180, le=180),
    to_lat: float = Query(ge=-90, le=90),
    to_lng: float = Query(ge=-180, le=180),
    budget_min: int | None = Query(None, ge=0, description="Only this budget's scenic route; omit for every budget"),
    from_name: str | None = Query(None, max_length=200),
    to_name: str | None = Query(None, max_length=200),
):
    started = time.perf_counter()
    if haversine_m(from_lat, from_lng, to_lat, to_lng) > settings.MAX_STRAIGHT_LINE_M:
        raise HTTPException(422, "That's a long walk; try somewhere closer.")
    city = find_city(from_lat, from_lng, to_lat, to_lng)
    if budget_min is not None and budget_min not in city.config.budgets:
        raise HTTPException(422, f"budget_min must be one of {city.config.budgets}.")

    start, end = (from_lat, from_lng), (to_lat, to_lng)
    body = route_cache.get(city, start, end)
    cached = body is not None
    if not cached:
        with COMPUTE_LOCK:
            body = route_cache.get(city, start, end)  # another request may have just computed it
            cached = body is not None
            if not cached:
                body = compute(city, start, end)
                route_cache.put(city, start, end, body)

    scenic = body["scenic"] if budget_min is None else {str(budget_min): body["scenic"][str(budget_min)]}
    return {
        "id": None,
        "label": None,
        "city_id": city.config.id,
        "start": {"id": "start", "name": from_name or "Start", "lat": from_lat, "lng": from_lng},
        "end": {"id": "end", "name": to_name or "Destination", "lat": to_lat, "lng": to_lng},
        "fastest": body["fastest"],
        "scenic": scenic,
        "pois": body["pois"],
        "meta": {"cached": cached, "elapsed_ms": round((time.perf_counter() - started) * 1000)},
    }
