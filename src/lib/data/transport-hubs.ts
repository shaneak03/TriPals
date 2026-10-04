import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type TransportHub = {
  id: string;
  name: string;
  hub_type: "airport" | "train_station" | "bus_station";
  iata_code: string | null;
  iata_city_code: string | null;
  operator: string | null;
  coordinates: string | { latitude: number; longitude: number } | null;
};

export async function getAirportForCity(cityCode?: string) {
  if (!cityCode) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("transport_hubs")
    .select("id, name, hub_type, iata_code, iata_city_code, operator, coordinates")
    .eq("hub_type", "airport")
    .eq("iata_city_code", cityCode)
    .not("iata_code", "is", null)
    .order("name")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as TransportHub | null;
}

export async function getAirportByCode(iataCode?: string) {
  if (!iataCode) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("transport_hubs")
    .select("id, name, hub_type, iata_code, iata_city_code, operator, coordinates")
    .eq("hub_type", "airport")
    .eq("iata_code", iataCode)
    .order("name")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as TransportHub | null;
}
