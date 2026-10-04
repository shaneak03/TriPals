// Client for services/routing-api: live fastest + scenic routes between any two points.

import type { WalkFile } from "@/lib/walks";

const API_URL = process.env.NEXT_PUBLIC_ROUTING_API_URL?.replace(/\/$/, "");

export type RoutePoint = { name: string; lat: number; lng: number };

/** status 0 = the API couldn't be reached (offline, not configured, timed out). */
export class RoutingError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Ids of cities the API has loaded, or null when the API is unreachable/not configured. */
export async function getLiveCities(): Promise<Set<string> | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}/cities`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { cities: { id: string }[] };
    return new Set(data.cities.map((c) => c.id));
  } catch {
    return null;
  }
}

const cache = new Map<string, Promise<WalkFile>>();

export function fetchRoute(start: RoutePoint, end: RoutePoint): Promise<WalkFile> {
  if (!API_URL) return Promise.reject(new RoutingError("Live routing is offline", 0));
  const key = [start.lat, start.lng, end.lat, end.lng].map((n) => n.toFixed(5)).join(",");
  let request = cache.get(key);
  if (!request) {
    const params = new URLSearchParams({
      from_lat: String(start.lat),
      from_lng: String(start.lng),
      to_lat: String(end.lat),
      to_lng: String(end.lng),
      from_name: start.name,
      to_name: end.name,
    });
    request = fetch(`${API_URL}/route?${params}`, { signal: AbortSignal.timeout(30_000) })
      .catch(() => {
        throw new RoutingError("Live routing is offline", 0);
      })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          const detail = typeof body?.detail === "string" ? body.detail : "We couldn't plan that walk. Please try again.";
          throw new RoutingError(detail, res.status);
        }
        return body as WalkFile;
      });
    request.catch(() => cache.delete(key));
    cache.set(key, request);
  }
  return request;
}
