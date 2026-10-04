import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getOrCreateCity, getOrCreateLocation } from "@/lib/data/locations";
import type { Journey, SearchRequest } from "@/lib/journeys/types";

export async function saveJourneySearch(request: SearchRequest, journeys: Journey[]) {
  const supabase = getSupabaseAdmin();
  const originLocationId = await getOrCreateCity(request.origin.name);
  const destinationLocationId = await getOrCreateCity(request.destination.name);

  const { data: search, error: searchError } = await supabase
    .from("searches")
    .insert({
      origin_location_id: originLocationId,
      destination_location_id: destinationLocationId,
      departure_date: request.departureDate,
      return_date: request.returnDate ?? null,
      travellers: request.travellers,
      currency: request.currency,
      requested_modes: request.modes ?? ["flight", "train", "coach"],
      optimise_for: request.optimiseFor ?? "value",
      request_hash: JSON.stringify(request),
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
        metadata: { priceSource: journey.priceSource, priceUnavailable: journey.priceUnavailable },
      })
      .select("id")
      .single();

    if (journeyError) throw journeyError;

    const legRows = await Promise.all(journey.legs.map(async (leg, sequence) => ({
      journey_id: savedJourney.id,
      sequence,
      mode: leg.mode,
      origin_location_id: await getOrCreateLocation(leg.origin),
      destination_location_id: await getOrCreateLocation(leg.destination),
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

  return { searchId: search.id, journeys: savedJourneys };
}
