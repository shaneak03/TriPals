import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function getAirportTransferEstimate(
  airportCode: string | undefined,
  cityCode: string | undefined,
  direction: "to_airport" | "from_airport",
  currency: string,
) {
  if (!airportCode || !cityCode) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("airport_transfer_estimates")
    .select("duration_minutes, price_minor, currency, operator")
    .eq("airport_iata_code", airportCode)
    .eq("city_code", cityCode)
    .eq("direction", direction)
    .in("currency", currency === "GBP" ? ["GBP"] : [currency, "GBP"])
    .order("currency", { ascending: currency !== "GBP" })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
