import { NextResponse } from "next/server";
import { searchJourneys } from "@/lib/journeys/engine";
import { demoCoachProvider, demoFlightProvider, demoTrainProvider } from "@/lib/journeys/providers";
import type { SearchRequest } from "@/lib/journeys/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const providers = [demoFlightProvider, demoTrainProvider, demoCoachProvider];

async function getOrCreateLocation(supabase: ReturnType<typeof getSupabaseAdmin>, name: string) {
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<SearchRequest>;

    if (!body.origin?.name || !body.destination?.name || !body.departureDate) {
      return NextResponse.json(
        { error: "origin, destination, and departureDate are required" },
        { status: 400 },
      );
    }

    const searchRequest: SearchRequest = {
      origin: body.origin,
      destination: body.destination,
      departureDate: body.departureDate,
      returnDate: body.returnDate,
      travellers: body.travellers ?? 1,
      currency: body.currency ?? "GBP",
      modes: body.modes,
      optimiseFor: body.optimiseFor ?? "value",
    };

    const journeys = await searchJourneys(searchRequest, providers);
    const supabase = getSupabaseAdmin();
    const originLocationId = await getOrCreateLocation(supabase, searchRequest.origin.name);
    const destinationLocationId = await getOrCreateLocation(supabase, searchRequest.destination.name);
    const requestHash = JSON.stringify(searchRequest);

    const { data: search, error: searchError } = await supabase
      .from("searches")
      .insert({
        origin_location_id: originLocationId,
        destination_location_id: destinationLocationId,
        departure_date: searchRequest.departureDate,
        return_date: searchRequest.returnDate ?? null,
        travellers: searchRequest.travellers,
        currency: searchRequest.currency,
        requested_modes: searchRequest.modes ?? ["flight", "train", "coach"],
        optimise_for: searchRequest.optimiseFor ?? "value",
        request_hash: requestHash,
        status: "complete",
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (searchError) throw searchError;

    const savedJourneys = [];
    for (const [rank, journey] of journeys.entries()) {
      const { data: savedJourney, error: journeyError } = await supabase
        .from("journeys")
        .insert({
          search_id: search.id,
          journey_type: journey.type,
          total_price_minor: journey.totalPriceMinor,
          currency: journey.currency,
          total_duration_minutes: journey.totalDurationMinutes,
          total_wait_minutes: journey.totalWaitMinutes,
          transfer_count: journey.transferCount,
          walking_minutes: journey.walkingMinutes,
          booking_type: journey.bookingType,
          value_score: journey.scores.value,
          convenience_score: journey.scores.convenience,
          scenic_score: journey.scores.scenic,
          rank: rank + 1,
          warnings: journey.warnings,
        })
        .select("id")
        .single();

      if (journeyError) throw journeyError;

      const legRows = await Promise.all(journey.legs.map(async (leg, sequence) => ({
        journey_id: savedJourney.id,
        sequence,
        mode: leg.mode,
        origin_location_id: await getOrCreateLocation(supabase, leg.origin),
        destination_location_id: await getOrCreateLocation(supabase, leg.destination),
        departure_at: leg.departureAt ?? null,
        arrival_at: leg.arrivalAt ?? null,
        duration_minutes: leg.durationMinutes,
        price_minor: leg.priceMinor,
        currency: leg.currency,
        operator: leg.operator ?? null,
        service_number: leg.serviceNumber ?? null,
        booking_url: leg.bookingUrl ?? null,
        is_self_transfer: leg.isSelfTransfer ?? false,
        is_estimated_price: leg.isEstimatedPrice ?? false,
        details: leg.details ?? {},
      })));

      const { error: legsError } = await supabase.from("journey_legs").insert(legRows);
      if (legsError) throw legsError;
      savedJourneys.push({ ...journey, id: savedJourney.id });
    }

    return NextResponse.json({ searchId: search.id, request: searchRequest, journeys: savedJourneys });
  } catch {
    return NextResponse.json({ error: "Unable to search journeys" }, { status: 500 });
  }
}
