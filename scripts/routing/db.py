"""Supabase access for the routing pipeline (service role: bypasses RLS, never ship to the frontend).

Reads per-city configuration: the city bbox, POI categories, places, active route
pairs and time budgets. Credentials come from scripts/routing/.env.
"""

import os
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

ENV_PATH = Path(__file__).resolve().parent / ".env"


@cache
def client() -> Client:
    load_dotenv(ENV_PATH)
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit(f"Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in {ENV_PATH} (see .env.example).")
    return create_client(url, key)


@dataclass(frozen=True)
class Category:
    id: str
    label: str
    osm_tags: dict  # {"tourism": ["museum"]} or {"historic": "*"}
    weight: int
    icon: str
    sort_order: int


@dataclass(frozen=True)
class Place:
    id: str  # uuid
    slug: str
    name: str
    lat: float
    lng: float


@dataclass(frozen=True)
class Pair:
    id: str
    label: str
    start: Place
    end: Place


@dataclass(frozen=True)
class CityConfig:
    id: str
    name: str
    bbox: tuple[float, float, float, float]  # (west, south, east, north), the order osmnx expects
    categories: list[Category]  # highest weight first: the first match classifies a feature
    pairs: list[Pair]  # active pairs, by sort_order; the first is the main demo pair
    budgets: list[int]  # extra minutes, ascending


def _point(geojson) -> tuple[float, float]:
    lng, lat = geojson["coordinates"]
    return lat, lng


def load_city(city_id: str) -> CityConfig:
    db = client()
    rows = db.table("cities").select("id, name, bbox, is_active").eq("id", city_id).execute().data
    if not rows:
        raise SystemExit(f"No city '{city_id}' in Supabase (table cities).")
    city = rows[0]
    if not city["is_active"]:
        raise SystemExit(f"City '{city_id}' is not active.")
    ring = city["bbox"]["coordinates"][0]
    xs, ys = [c[0] for c in ring], [c[1] for c in ring]

    categories = [
        Category(r["id"], r["label"], r["osm_tags"], r["weight"], r["icon"], r["sort_order"])
        for r in db.table("poi_categories").select("*").execute().data
    ]
    categories.sort(key=lambda c: (-c.weight, c.sort_order, c.id))

    places = {}
    for r in db.table("places").select("id, slug, name, location").eq("city_id", city_id).execute().data:
        lat, lng = _point(r["location"])
        places[r["id"]] = Place(r["id"], r["slug"], r["name"], lat, lng)

    pair_rows = (
        db.table("route_pairs").select("*").eq("city_id", city_id).eq("is_active", True)
        .order("sort_order").order("id").execute().data
    )
    pairs = [Pair(r["id"], r["label"], places[r["start_place_id"]], places[r["end_place_id"]]) for r in pair_rows]

    budgets = sorted(r["minutes"] for r in db.table("time_budgets").select("minutes").execute().data)
    return CityConfig(city["id"], city["name"], (min(xs), min(ys), max(xs), max(ys)), categories, pairs, budgets)


# ---------------------------------------------------------------- writes

POI_BATCH = 1000


def upsert_pois(city_id: str, pois: list[dict], run_started: str) -> None:
    """Insert or update a city's POIs. `updated_at` marks rows seen in this run (see prune_pois)."""
    rows = [
        {
            "id": p["id"],
            "city_id": city_id,
            "name": p["name"],
            "category_id": p["category"],
            "weight": p["weight"],
            "location": f"SRID=4326;POINT({p['lng']} {p['lat']})",
            "updated_at": run_started,
        }
        for p in pois
    ]
    for i in range(0, len(rows), POI_BATCH):
        client().table("pois").upsert(rows[i : i + POI_BATCH], on_conflict="id").execute()


def prune_pois(city_id: str, run_started: str) -> int:
    """Delete the city's POIs not seen in this run (closed or renamed in OSM, or now uncategorised)."""
    deleted = (
        client().table("pois").delete().eq("city_id", city_id).lt("updated_at", run_started).execute().data
    )
    return len(deleted)


def replace_pair_routes(pair_id: str, routes: list[dict]) -> int:
    """Atomically upsert a pair's routes and their ordered POIs; drops routes not in `routes`."""
    return client().rpc("replace_pair_routes", {"p_pair_id": pair_id, "p_routes": routes}).execute().data


def delete_routes_of_inactive_pairs(city_id: str) -> int:
    inactive = [
        r["id"]
        for r in client().table("route_pairs").select("id").eq("city_id", city_id).eq("is_active", False).execute().data
    ]
    if not inactive:
        return 0
    return len(client().table("routes").delete().in_("pair_id", inactive).execute().data)


# ---------------------------------------------------------------- reads used by the fallback export


def walk_options(city_id: str) -> dict:
    return client().rpc("get_walk_options", {"p_city_id": city_id}).execute().data


def walk_routes(pair_id: str) -> dict:
    return client().rpc("get_routes", {"p_pair_id": pair_id}).execute().data
