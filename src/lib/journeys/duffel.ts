import type { JourneyLeg, SearchRequest, TransportProvider } from "./types";

type DuffelSegment = {
  departing_at: string;
  arriving_at: string;
  duration: string;
  marketing_carrier?: { name?: string };
  operating_carrier?: { name?: string };
  marketing_carrier_flight_number?: string;
  origin: { iata_code: string; name?: string };
  destination: { iata_code: string; name?: string };
};

type DuffelOffer = {
  id: string;
  total_amount: string;
  total_currency: string;
  expires_at?: string;
  slices: Array<{ segments: DuffelSegment[] }>;
};

type DuffelResponse = { data?: { offers?: DuffelOffer[] } };

function toMinutes(duration: string) {
  const match = duration.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function toMinorUnits(amount: string) {
  return Math.round(Number(amount) * 100);
}

function airportCode(location: SearchRequest["origin"]) {
  if (location.code) return location.code.toUpperCase();

  const knownCodes: Record<string, string> = {
    london: "LON",
    milan: "MIL",
    paris: "PAR",
    barcelona: "BCN",
    lisbon: "LIS",
  };

  const code = knownCodes[location.name.trim().toLowerCase()];
  if (!code) throw new Error(`Add an airport or city code for ${location.name}`);
  return code;
}

export const duffelFlightProvider: TransportProvider = {
  name: "Duffel",
  mode: "flight",
  async search(request) {
    const token = process.env.DUFFEL_API_TOKEN;
    if (!token) throw new Error("DUFFEL_API_TOKEN is not configured");

    const slices = [{
      origin: airportCode(request.origin),
      destination: airportCode(request.destination),
      departure_date: request.departureDate,
    }];

    if (request.returnDate) {
      slices.push({
        origin: airportCode(request.destination),
        destination: airportCode(request.origin),
        departure_date: request.returnDate,
      });
    }

    const response = await fetch("https://api.duffel.com/air/offer_requests", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Duffel-Version": "v2",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        data: {
          slices,
          passengers: Array.from({ length: request.travellers }, () => ({ type: "adult" })),
          cabin_class: "economy",
          max_connections: 2,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Duffel flight search failed with status ${response.status}`);
    }

    const payload = (await response.json()) as DuffelResponse;
    return (payload.data?.offers ?? []).slice(0, 10).map((offer) =>
      offer.slices.flatMap((slice) => slice.segments.map((segment): JourneyLeg => ({
        mode: "flight",
        origin: segment.origin.name ?? segment.origin.iata_code,
        destination: segment.destination.name ?? segment.destination.iata_code,
        departureAt: segment.departing_at,
        arrivalAt: segment.arriving_at,
        durationMinutes: toMinutes(segment.duration),
        priceMinor: toMinorUnits(offer.total_amount),
        currency: offer.total_currency,
        operator: segment.operating_carrier?.name ?? segment.marketing_carrier?.name,
        serviceNumber: segment.marketing_carrier_flight_number,
        isEstimatedPrice: false,
        details: {
          provider: "duffel",
          offerId: offer.id,
          expiresAt: offer.expires_at,
        },
      }))),
    );
  },
};
