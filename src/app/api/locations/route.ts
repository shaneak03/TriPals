import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("locations")
      .select("id, name, country_code, provider_refs")
      .eq("location_type", "city")
      .order("name");

    if (error) throw error;

    const cities = (data ?? [])
      .map((location) => ({
        id: location.id,
        name: location.name,
        countryCode: location.country_code,
        code: (location.provider_refs as { duffel_code?: string } | null)?.duffel_code,
      }))
      .filter((city) => city.code);

    return NextResponse.json({ cities });
  } catch {
    return NextResponse.json({ error: "Unable to load cities" }, { status: 500 });
  }
}
