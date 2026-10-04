import type { Journey, JourneyLeg, SearchRequest, TransportProvider } from "./types";
import { addTransitousAirportTransfers } from "./airport-transfers";
import { convertMinorUnits } from "@/lib/currency";

const id = () => crypto.randomUUID();

function totalPrice(legs: JourneyLeg[]) {
  return legs.reduce((sum, leg) => sum + leg.priceMinor, 0);
}

function totalDuration(legs: JourneyLeg[]) {
  return legs.reduce((sum, leg) => sum + leg.durationMinutes, 0);
}

function journeyType(legs: JourneyLeg[]): Journey["type"] {
  const modes = new Set(legs.map((leg) => leg.mode));
  // Airport transfers are access legs of the flight, not a mixed transport
  // journey. A true mixed route is only used for journeys combining other
  // primary modes such as train + coach.
  if (modes.has("flight")) return "flight";
  if (modes.has("train")) return modes.size > 1 ? "mixed" : "train";
  return modes.size > 1 ? "mixed" : "coach";
}

export function assembleJourney(legs: JourneyLeg[], currency: string): Journey {
  const mainLegs = legs.filter((leg) => ["flight", "train", "coach"].includes(leg.mode));
  const hasSelfTransfer = legs.some((leg) => leg.isSelfTransfer);
  const walkingMinutes = legs
    .filter((leg) => leg.mode === "walking")
    .reduce((sum, leg) => sum + leg.durationMinutes, 0);
  const priceUnavailable = legs.some((leg) => leg.isEstimatedPrice && leg.priceMinor === 0);
  const hasDemoLeg = legs.some((leg) => leg.details?.provider?.toString().startsWith("demo"));
  const hasEstimatedLeg = legs.some((leg) => leg.isEstimatedPrice && leg.priceMinor > 0);
  const priceSource = priceUnavailable ? "unavailable" : hasDemoLeg ? "demo" : hasEstimatedLeg ? "estimated" : "live";

  return {
    id: id(),
    type: journeyType(legs),
    legs,
    totalPriceMinor: totalPrice(legs),
    priceUnavailable,
    priceSource,
    currency,
    totalDurationMinutes: totalDuration(legs),
    totalWaitMinutes: Math.max(0, totalDuration(legs) - mainLegs.reduce((sum, leg) => sum + leg.durationMinutes, 0)),
    transferCount: Math.max(0, legs.length - 1),
    walkingMinutes,
    bookingType: hasSelfTransfer ? "multiple_bookings" : "unknown",
    scores: { value: 0, convenience: 0, scenic: walkingMinutes },
    warnings: [
      ...(hasSelfTransfer ? ["This route includes a self-transfer between bookings."] : []),
      ...(priceUnavailable ? ["One or more fares are unavailable and have not been included in the total."] : []),
    ],
  };
}

export async function searchJourneys(
  request: SearchRequest,
  providers: TransportProvider[],
): Promise<Journey[]> {
  const selectedModes = request.modes ?? ["flight", "train", "coach"];
  const activeProviders = providers.filter((provider) => selectedModes.includes(provider.mode));
  const results = await Promise.all(activeProviders.map((provider) => provider.search(request)));

  // Transitous is a public endpoint with strict rate limits. Process these
  // enrichments sequentially instead of sending one pair of requests per
  // flight at the same time.
  const resolvedJourneys: Journey[] = [];
  for (const legs of results.flat()) {
    const enrichedLegs = await addTransitousAirportTransfers(legs, request.origin, request.destination, request.currency);
    const normalizedLegs = await Promise.all(enrichedLegs.map(async (leg) => {
      if (leg.currency === request.currency) return leg;
      const convertedPrice = await convertMinorUnits(leg.priceMinor, leg.currency, request.currency);
      return {
        ...leg,
        priceMinor: convertedPrice,
        currency: request.currency,
        details: {
          ...leg.details,
          originalPriceMinor: leg.priceMinor,
          originalCurrency: leg.currency,
          conversionApplied: true,
        },
      };
    }));
    const journey = assembleJourney(normalizedLegs, request.currency);
    // Transitous city-to-city results are valid alternatives, but do not let
    // their transit legs appear attached to a flight card.
    resolvedJourneys.push(journey);
  }

  const maxPrice = Math.max(...resolvedJourneys.map((journey) => journey.totalPriceMinor), 1);
  const maxDuration = Math.max(...resolvedJourneys.map((journey) => journey.totalDurationMinutes), 1);

  return resolvedJourneys
    .map((journey) => ({
      ...journey,
      scores: {
        ...journey.scores,
        value: Math.round((journey.priceUnavailable ? 0 : (1 - journey.totalPriceMinor / maxPrice) * 70) + (1 - journey.totalDurationMinutes / maxDuration) * 30),
        convenience: Math.max(0, 100 - journey.transferCount * 15 - (journey.bookingType === "multiple_bookings" ? 20 : 0)),
      },
    }))
    .sort((a, b) => {
      if (request.optimiseFor === "time") return a.totalDurationMinutes - b.totalDurationMinutes;
      if (request.optimiseFor === "price") return a.totalPriceMinor - b.totalPriceMinor;
      return b.scores.value - a.scores.value;
    });
}
