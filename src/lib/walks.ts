import { getSupabaseBrowser } from "@/lib/supabase/client";

// Shapes returned by the Supabase RPCs get_walk_options() and get_routes()
// (supabase/migrations/*_scenic_walks.sql). The fallback JSON in
// public/data/walks/<city>/ is exported from the same RPCs, so it has the same shape.

export type Place = { id: string; name: string; lat: number; lng: number };

export type OptionPlace = Place & { kind: string; selectable: boolean };

export type WalkPair = { id: string; label: string; start: OptionPlace; end: OptionPlace };

export type TimeBudget = { minutes: number; label: string; is_default: boolean };

export type WalkOptions = {
  city: { id: string; name: string; country: string; centre: [number, number]; bbox: [number, number, number, number] };
  pairs: WalkPair[];
  budgets: TimeBudget[];
  categories: { id: string; label: string; icon: string; weight: number; is_highlighted: boolean }[];
};

export type LineString = { type: "LineString"; coordinates: [number, number][] };

export type Route = {
  geometry: LineString;
  distance_m: number;
  duration_min: number;
  extra_min: number | null;
  extra_pois: number | null;
  poi_score: number;
  poi_ids: string[]; // walking order
  poi_minutes: number[]; // minutes from the start, parallel to poi_ids
};

export type Poi = {
  id: string;
  name: string;
  category: string;
  category_label: string;
  icon: string; // Lucide icon name, see walk-icons.ts
  weight: number;
  highlighted: boolean; // from Supabase (poi_categories.is_highlighted / highlight_if_tags)
  lat: number;
  lng: number;
};

export type WalkFile = {
  id: string | null; // pair id for suggested walks; null for live routes
  label: string | null;
  start: Place;
  end: Place;
  fastest: Route | null; // null until the pipeline has computed this pair
  scenic: Record<string, Route>; // keyed by budget minutes
  pois: Poi[];
};

export type City = {
  id: string;
  name: string;
  country: string;
  bbox: [number, number, number, number]; // west, south, east, north
  centre: [number, number]; // lng, lat
};

/** "live" = read from Supabase; "saved" = the static fallback in public/data/walks. */
export type DataSource = "live" | "saved";

export type Loaded<T> = { data: T; source: DataSource };

const TIMEOUT_MS = 6000;

async function rpcOrFallback<T>(
  fn: string,
  args: Record<string, unknown>,
  fallbackUrl: string,
  isUsable: (data: T | null) => data is T,
): Promise<Loaded<T>> {
  const supabase = getSupabaseBrowser();
  if (supabase) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const { data, error } = await supabase.rpc(fn, args).abortSignal(controller.signal);
      if (!error && isUsable(data as T | null)) return { data: data as T, source: "live" };
      if (error) console.warn(`Supabase ${fn} failed, using saved data:`, error.message);
    } catch (err) {
      console.warn(`Supabase ${fn} unreachable, using saved data:`, err);
    } finally {
      clearTimeout(timer);
    }
  }
  const res = await fetch(fallbackUrl);
  if (!res.ok) throw new Error("Walk data is unavailable right now");
  return { data: (await res.json()) as T, source: "saved" };
}

const cache = new Map<string, Promise<Loaded<unknown>>>();

function cached<T>(key: string, load: () => Promise<Loaded<T>>): Promise<Loaded<T>> {
  let promise = cache.get(key) as Promise<Loaded<T>> | undefined;
  if (!promise) {
    promise = load();
    promise.catch(() => cache.delete(key));
    cache.set(key, promise);
  }
  return promise;
}

type CityRow = {
  id: string;
  name: string;
  country: string;
  bbox: { coordinates: [number, number][][] };
  centre: { coordinates: [number, number] };
};

/** Active cities from Supabase (PostGIS columns arrive as GeoJSON), or the saved list. */
export function loadCities(): Promise<Loaded<City[]>> {
  return cached("cities", async () => {
    const supabase = getSupabaseBrowser();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("cities")
          .select("id, name, country, bbox, centre")
          .eq("is_active", true)
          .order("name")
          .abortSignal(AbortSignal.timeout(TIMEOUT_MS));
        if (!error && data?.length) {
          const cities = (data as CityRow[]).map((row) => {
            const ring = row.bbox.coordinates[0];
            const xs = ring.map((c) => c[0]);
            const ys = ring.map((c) => c[1]);
            return {
              id: row.id,
              name: row.name,
              country: row.country,
              bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as City["bbox"],
              centre: row.centre.coordinates,
            };
          });
          return { data: cities, source: "live" as const };
        }
      } catch (err) {
        console.warn("Supabase cities unreachable, using saved list:", err);
      }
    }
    const res = await fetch("/data/walks/cities.json");
    if (!res.ok) throw new Error("Walk data is unavailable right now");
    return { data: (await res.json()) as City[], source: "saved" as const };
  });
}

export function loadWalkOptions(cityId: string): Promise<Loaded<WalkOptions>> {
  return cached(`options:${cityId}`, () =>
    rpcOrFallback<WalkOptions>(
      "get_walk_options",
      { p_city_id: cityId },
      `/data/walks/${cityId}/options.json`,
      (d): d is WalkOptions => !!d && Array.isArray(d.pairs) && d.pairs.length > 0,
    ),
  );
}

/** Fastest route plus the scenic route for every budget, in one call. */
export function loadWalk(cityId: string, pairId: string): Promise<Loaded<WalkFile>> {
  return cached(`walk:${pairId}`, () =>
    rpcOrFallback<WalkFile>(
      "get_routes",
      { p_pair_id: pairId },
      `/data/walks/${cityId}/routes/${pairId}.json`,
      (d): d is WalkFile => !!d && !!d.fastest,
    ),
  );
}

/**
 * Highlighted POIs (landmarks, museums, churches, parks…; set per category in Supabase)
 * are pinned, listed and counted as sights. Cafés and shops still shape the scenic route
 * through the street score but aren't shown.
 */
export const isSight = (poi: Poi) => poi.highlighted;

export function countSights(route: Route, poisById: Map<string, Poi>) {
  return route.poi_ids.reduce((n, id) => n + (poisById.get(id)?.highlighted ? 1 : 0), 0);
}

export const formatMinutes = (min: number) => `${Math.round(min)} min`;

export const formatDistance = (metres: number) =>
  metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`;
