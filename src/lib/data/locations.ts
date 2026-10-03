import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function getCities() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, country_code, provider_refs")
    .eq("location_type", "city")
    .order("name");

  if (error) throw error;

  return (data ?? [])
    .map((location) => ({
      id: location.id,
      name: location.name,
      countryCode: location.country_code,
      code: (location.provider_refs as { duffel_code?: string } | null)?.duffel_code,
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
