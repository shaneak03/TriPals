import { getSupabaseAdmin } from "@/lib/supabase/admin";

function parseCoordinates(value: unknown) {
  if (typeof value !== "string") return value as { latitude: number; longitude: number } | null;
  const match = value.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/i);
  if (match) return { longitude: Number(match[1]), latitude: Number(match[2]) };

  // Supabase may return geography columns as PostGIS EWKB hex.
  const hex = value.replace(/^\\x/i, "");
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 50) return null;

  try {
    const bytes = new Uint8Array(hex.match(/../g)!.map((pair) => Number.parseInt(pair, 16)));
    const view = new DataView(bytes.buffer);
    const littleEndian = bytes[0] === 1;
    const longitude = view.getFloat64(9, littleEndian);
    const latitude = view.getFloat64(17, littleEndian);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { longitude, latitude };
  } catch {
    return null;
  }
}

export async function getCities() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, country_code, provider_refs, coordinates")
    .eq("location_type", "city")
    .order("name");

  if (error) throw error;

  return (data ?? [])
    .map((location) => ({
      id: location.id,
      name: location.name,
      countryCode: location.country_code,
      code: (location.provider_refs as { duffel_code?: string } | null)?.duffel_code,
      coordinates: parseCoordinates(location.coordinates),
    }))
    .filter((city) => city.code);
}

export async function getOrCreateCity(name: string) {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from("locations")
    .select("id")
    .eq("name", name)
    .eq("location_type", "city")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("locations")
    .insert({ name, city_name: name, location_type: "city" })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function getOrCreateLocation(name: string) {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from("locations")
    .select("id")
    .eq("name", name)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("locations")
    .insert({ name, location_type: "poi" })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}
