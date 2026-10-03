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
