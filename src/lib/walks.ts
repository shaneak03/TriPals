import {
  Brush,
  Camera,
  Castle,
  Church,
  Coffee,
  Droplets,
  Eye,
  Flower2,
  Landmark,
  Palette,
  ShoppingBag,
  Trees,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";

// Shapes of the files written by scripts/routing/precompute.py.

export type Place = { id: string; name: string; lat: number; lng: number };

export type LineString = { type: "LineString"; coordinates: [number, number][] };

export type Route = {
  geometry: LineString;
  distance_m: number;
  duration_min: number;
  poi_ids: string[]; // walking order
  poi_minutes: number[]; // minutes from the start, parallel to poi_ids
  poi_score: number;
};

export type ScenicRoute = Route & { extra_min: number; extra_pois: number };

export type Poi = { id: string; name: string; category: string; weight: number; lat: number; lng: number };

export type WalkFile = {
  id: string;
  start: Place;
  end: Place;
  fastest: Route;
  scenic: Record<string, ScenicRoute>;
  pois: Poi[];
};

export type WalkPair = { id: string; start: Place; end: Place };

export type WalkIndex = { pairs: WalkPair[]; budgets: number[] };

const cache = new Map<string, Promise<WalkFile>>();

export function loadWalk(pairId: string): Promise<WalkFile> {
  let walk = cache.get(pairId);
  if (!walk) {
    walk = fetch(`/data/routes/${pairId}.json`).then((res) => {
      if (!res.ok) throw new Error(`Couldn't load walk ${pairId} (${res.status})`);
      return res.json() as Promise<WalkFile>;
    });
    walk.catch(() => cache.delete(pairId));
    cache.set(pairId, walk);
  }
  return walk;
}

/** Sights, parks, churches and fountains get pins; cafés and shops only count towards the total. */
export const isSight = (poi: Poi) => poi.weight >= 2;

const categories: Record<string, { label: string; icon: LucideIcon }> = {
  attraction: { label: "Landmark", icon: Camera },
  museum: { label: "Museum", icon: Landmark },
  gallery: { label: "Gallery", icon: Palette },
  artwork: { label: "Artwork", icon: Brush },
  viewpoint: { label: "Viewpoint", icon: Eye },
  historic: { label: "Historic", icon: Castle },
  place_of_worship: { label: "Church", icon: Church },
  fountain: { label: "Fountain", icon: Droplets },
  park: { label: "Park", icon: Trees },
  garden: { label: "Garden", icon: Flower2 },
  cafe: { label: "Café", icon: Coffee },
  restaurant: { label: "Restaurant", icon: UtensilsCrossed },
  bar: { label: "Bar", icon: Wine },
  shop: { label: "Shop", icon: ShoppingBag },
};

export function categoryOf(poi: Poi) {
  return categories[poi.category] ?? { label: poi.category, icon: Camera };
}

export const formatMinutes = (min: number) => `${Math.round(min)} min`;

export const formatDistance = (metres: number) =>
  metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`;
