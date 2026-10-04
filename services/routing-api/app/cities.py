"""Loaded cities: config from Supabase plus the scored walk graph, kept in memory."""

import logging
import multiprocessing
from dataclasses import dataclass

from walkroute import db
from walkroute.cache import is_stale, routes_fingerprint
from walkroute.db import CityConfig
from walkroute.routing import CityGraph, load_city_graph

from . import settings

log = logging.getLogger("routing-api")


@dataclass
class LoadedCity:
    config: CityConfig
    graph: CityGraph
    inputs_hash: str  # route_cache key part: changes when scores, categories or budgets change
    categories: dict  # id -> Category

    def contains(self, lat: float, lng: float) -> bool:
        w, s, e, n = self.config.bbox
        m = settings.CITY_MARGIN_DEG
        return w - m <= lng <= e + m and s - m <= lat <= n + m


def _build_cache(city_id: str) -> None:
    """Runs in a child process: downloading and scoring needs ~1 GB, which is returned
    to the OS when the child exits, so the API itself stays small."""
    from walkroute.cache import ensure_scored_graph

    ensure_scored_graph(db.load_city(city_id))


def load_cities() -> dict[str, LoadedCity]:
    wanted = settings.ROUTING_CITIES or db.active_city_ids()
    loaded = {}
    for city_id in wanted:
        try:
            config = db.load_city(city_id)
        except LookupError as err:
            log.warning("Skipping %s: %s", city_id, err)
            continue
        if is_stale(config):
            log.info("%s: building walk graph cache (first run or inputs changed), this can take a minute…", city_id)
            child = multiprocessing.get_context("spawn").Process(target=_build_cache, args=(city_id,))
            child.start()
            child.join()
            if child.exitcode != 0:
                log.error("%s: cache build failed (exit %s); skipping", city_id, child.exitcode)
                continue
        graph = load_city_graph(config)
        loaded[city_id] = LoadedCity(config, graph, routes_fingerprint(config), {c.id: c for c in config.categories})
        log.info("%s: loaded %d nodes, %d POIs", city_id, len(graph.node_ids), len(graph.pois_by_id))
    return loaded
