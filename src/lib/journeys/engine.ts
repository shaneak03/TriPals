import type { Journey, JourneyLeg, SearchRequest, TransportProvider } from "./types";

const id = () => crypto.randomUUID();

function totalPrice(legs: JourneyLeg[]) {
  return legs.reduce((sum, leg) => sum + leg.priceMinor, 0);
}

function totalDuration(legs: JourneyLeg[]) {
  return legs.reduce((sum, leg) => sum + leg.durationMinutes, 0);
}

function journeyType(legs: JourneyLeg[]): Journey["type"] {
  const modes = new Set(legs.map((leg) => leg.mode));
  if (modes.has("flight")) return modes.size > 1 ? "mixed" : "flight";
  if (modes.has("train")) return modes.size > 1 ? "mixed" : "train";
  return modes.size > 1 ? "mixed" : "coach";
}

export function assembleJourney(legs: JourneyLeg[], currency: string): Journey {
  const mainLegs = legs.filter((leg) => ["flight", "train", "coach"].includes(leg.mode));
  const hasSelfTransfer = legs.some((leg) => leg.isSelfTransfer);
  const walkingMinutes = legs
    .filter((leg) => leg.mode === "walking")
    .reduce((sum, leg) => sum + leg.durationMinutes, 0);

  return {
    id: id(),
    type: journeyType(legs),
    legs,
    totalPriceMinor: totalPrice(legs),
    currency,
    totalDurationMinutes: totalDuration(legs),
    totalWaitMinutes: Math.max(0, totalDuration(legs) - mainLegs.reduce((sum, leg) => sum + leg.durationMinutes, 0)),
    transferCount: Math.max(0, legs.length - 1),
    walkingMinutes,
    bookingType: hasSelfTransfer ? "multiple_bookings" : "unknown",
    scores: { value: 0, convenience: 0, scenic: walkingMinutes },
    warnings: hasSelfTransfer ? ["This route includes a self-transfer between bookings."] : [],
  };
}

export async function searchJourneys(
  request: SearchRequest,
  providers: TransportProvider[],
): Promise<Journey[]> {
  const selectedModes = request.modes ?? ["flight", "train", "coach"];
  const activeProviders = providers.filter((provider) => selectedModes.includes(provider.mode));
  const results = await Promise.all(activeProviders.map((provider) => provider.search(request)));

  const journeys = results
    .flat()
    .map((legs) => assembleJourney(legs, request.currency));

  const maxPrice = Math.max(...journeys.map((journey) => journey.totalPriceMinor), 1);
  const maxDuration = Math.max(...journeys.map((journey) => journey.totalDurationMinutes), 1);

  return journeys
    .map((journey) => ({
      ...journey,
      scores: {
        ...journey.scores,
        value: Math.round((1 - journey.totalPriceMinor / maxPrice) * 70 + (1 - journey.totalDurationMinutes / maxDuration) * 30),
        convenience: Math.max(0, 100 - journey.transferCount * 15 - (journey.bookingType === "multiple_bookings" ? 20 : 0)),
      },
    }))
    .sort((a, b) => {
      if (request.optimiseFor === "time") return a.totalDurationMinutes - b.totalDurationMinutes;
      if (request.optimiseFor === "price") return a.totalPriceMinor - b.totalPriceMinor;
      return b.scores.value - a.scores.value;
    });
}
