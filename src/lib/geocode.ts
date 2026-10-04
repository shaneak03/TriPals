// Place search via Photon (photon.komoot.io): free OSM geocoder built for
// search-as-you-type. Not the public Nominatim server, whose usage policy forbids
// autocomplete. Results are limited to the selected city's bbox.

export type PlaceResult = { id: string; name: string; area: string; lat: number; lng: number };

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
};

const PHOTON = "https://photon.komoot.io";

function toResult(f: PhotonFeature): PlaceResult | null {
  const p = f.properties;
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const name = p.name || street;
  if (!name) return null;
  const area = [p.name && street !== name ? street : null, p.locality || p.district, p.city]
    .filter(Boolean)
    .filter((part, i, all) => all.indexOf(part) === i && part !== name)
    .join(", ");
  const [lng, lat] = f.geometry.coordinates;
  return { id: `${p.osm_type ?? ""}${p.osm_id ?? `${lat},${lng}`}`, name, area, lat, lng };
}

export async function searchPlaces(
  query: string,
  bbox: [number, number, number, number],
  centre: [number, number],
  signal?: AbortSignal,
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "8", // de-duplicated down to 5 below
    lang: "en",
    bbox: bbox.join(","),
    lat: String(centre[1]),
    lon: String(centre[0]),
  });
  const res = await fetch(`${PHOTON}/api/?${params}`, { signal });
  if (!res.ok) throw new Error("Place search is unavailable right now");
  const data = (await res.json()) as { features: PhotonFeature[] };
  const seen = new Set<string>();
  const results: PlaceResult[] = [];
  for (const feature of data.features) {
    const r = toResult(feature);
    const key = r && `${r.name}|${r.area}`;
    if (!r || seen.has(key!)) continue;
    seen.add(key!);
    results.push(r);
    if (results.length === 5) break;
  }
  return results;
}

/** Best-effort name for a point picked on the map. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`${PHOTON}/reverse?${new URLSearchParams({ lat: String(lat), lon: String(lng), lang: "en" })}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { features: PhotonFeature[] };
    return data.features[0] ? toResult(data.features[0])?.name ?? null : null;
  } catch {
    return null;
  }
}
