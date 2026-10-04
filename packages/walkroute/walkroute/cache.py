"""On-disk cache of each city's OSM download and scored graph, shared by the pipeline
and the routing API. Rebuilt automatically when the city's bbox or POI categories change."""

import hashlib
import json

from .config import CACHE_DIR, inputs_stamp_path, scored_graph_path, slim_graph_path
from .db import CityConfig

# Bump when routing changes in a way that should invalidate cached routes.
ALGORITHM_VERSION = "2"


def inputs_fingerprint(city: CityConfig) -> str:
    """Hash of everything the cached POIs and scored graph depend on."""
    inputs = {
        "bbox": city.bbox,
        "categories": [(c.id, c.osm_tags, c.weight, c.is_highlighted, c.highlight_if_tags) for c in city.categories],
    }
    return hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()


def routes_fingerprint(city: CityConfig) -> str:
    """Hash of everything a computed route depends on (for the route_cache table)."""
    inputs = {"graph": inputs_fingerprint(city), "budgets": city.budgets, "algorithm": ALGORITHM_VERSION}
    return hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()[:16]


def is_stale(city: CityConfig) -> bool:
    stamp = inputs_stamp_path(city.id)
    return (
        not scored_graph_path(city.id).exists()
        or not slim_graph_path(city.id).exists()
        or not stamp.exists()
        or stamp.read_text() != inputs_fingerprint(city)
    )


def ensure_scored_graph(city: CityConfig, refresh: bool = False) -> bool:
    """Make sure the cache holds an up-to-date scored graph (GraphML + slim pickle).

    Returns True if it was rebuilt. Rebuilding imports osmnx/geopandas and needs ~1 GB
    of RAM for a city like Milan; the routing API runs it in a child process.
    """
    from . import fetch, routing, score  # heavy imports, only when rebuilding

    stamp = inputs_stamp_path(city.id)
    fingerprint = inputs_fingerprint(city)
    if not (refresh or is_stale(city)):
        print(f"{city.id}: using cached OSM data and street scores (bbox and categories unchanged).")
        return False
    if stamp.exists() and stamp.read_text() == fingerprint and scored_graph_path(city.id).exists() and not refresh:
        routing.write_slim_graph(city.id)  # only the pickle was missing
        return True
    print(f"{city.id}: refreshing OSM data and street scores" + (" (--refresh)" if refresh else " (inputs changed)") + "…")
    fetch.setup_osmnx()
    fetch.fetch_graph(city)
    fetch.fetch_pois(city)
    score.main(city.id, city.crs, summary=False)
    routing.write_slim_graph(city.id)
    stamp.write_text(fingerprint)
    return True


__all__ = ["ALGORITHM_VERSION", "CACHE_DIR", "ensure_scored_graph", "inputs_fingerprint", "is_stale", "routes_fingerprint"]
