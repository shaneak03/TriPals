import type { JourneyLeg, TransportProvider } from "./types";

type TransitousLeg = {
  mode?: string;
  from?: { name?: string };
  to?: { name?: string };
  startTime?: string;
  endTime?: string;
  duration?: number;
  route?: { agencyName?: string; routeShortName?: string; routeLongName?: string };
};

type TransitousResponse = {
  itineraries?: Array<{ legs?: TransitousLeg[] }>;
};

function modeForLeg(mode?: string): JourneyLeg["mode"] {
  const normalized = mode?.toUpperCase();
  if (normalized === "WALK") return "walking";
  if (["BUS", "COACH", "TRAM", "SUBWAY", "METRO", "TRAIN", "RAIL", "HIGHSPEED_RAIL"].includes(normalized ?? "")) {
    return normalized === "BUS" || normalized === "COACH" ? "coach" : "train";
  }
  return "local_transit";
}

export const transitousProvider: TransportProvider = {
  name: "Transitous",
  mode: "train",
  async search(request) {
    if (!request.origin.coordinates || !request.destination.coordinates) return [];

    const fromPlace = `${request.origin.coordinates.latitude},${request.origin.coordinates.longitude}`;
    const toPlace = `${request.destination.coordinates.latitude},${request.destination.coordinates.longitude}`;
    const query = new URLSearchParams({
      fromPlace,
      toPlace,
      time: `${request.departureDate}T08:00:00Z`,
      maxTransfers: "4",
      numItineraries: "3",
      maxItineraries: "3",
    });

    const response = await fetch(`https://api.transitous.org/api/v6/plan?${query}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "TriPals/0.1 (hackathon prototype)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Transitous search failed with status ${response.status}: ${errorBody.slice(0, 300)}`);
    }
    const payload = (await response.json()) as TransitousResponse;

    return (payload.itineraries ?? []).map((itinerary) =>
      (itinerary.legs ?? []).map((leg): JourneyLeg => ({
        mode: modeForLeg(leg.mode),
        origin: leg.from?.name ?? request.origin.name,
        destination: leg.to?.name ?? request.destination.name,
        departureAt: leg.startTime,
        arrivalAt: leg.endTime,
        durationMinutes: Math.round((leg.duration ?? 0) / 60),
        priceMinor: 0,
        currency: request.currency,
        operator: leg.route?.agencyName,
        serviceNumber: leg.route?.routeShortName,
        isEstimatedPrice: true,
        details: {
          provider: "transitous",
          routeName: leg.route?.routeLongName,
          fareAvailable: false,
        },
      })),
    );
  },
};
