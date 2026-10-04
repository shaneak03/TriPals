import { getAirportByCode } from "@/lib/data/transport-hubs";
import { getAirportTransferEstimate } from "@/lib/data/airport-transfer-estimates";
import { convertMinorUnits } from "@/lib/currency";

// Keep the Transitous integration available for later, but use the fast
// Supabase estimates during the hackathon search flow.
const ENABLE_TRANSITOUS_AIRPORT_TRANSFERS = false;
import type { JourneyLeg, LocationInput } from "./types";

type TransitousLeg = {
  mode?: string;
  from?: { name?: string };
  to?: { name?: string };
  startTime?: string;
  endTime?: string;
  duration?: number;
  route?: { agencyName?: string; routeShortName?: string; routeLongName?: string };
};

type TransitousResponse = { itineraries?: Array<{ legs?: TransitousLeg[] }> };

function transitousTime(value: string) {
  // Duffel sometimes returns local airport times without an offset. Transitous
  // requires an ISO timestamp with a timezone, so treat those values as UTC.
  const parsed = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function coordinates(value: unknown) {
  if (typeof value === "object" && value && "latitude" in value && "longitude" in value) return value as { latitude: number; longitude: number };
  if (typeof value === "object" && value && "coordinates" in value) {
    const point = (value as { coordinates?: unknown }).coordinates;
    if (Array.isArray(point) && point.length >= 2) return { longitude: Number(point[0]), latitude: Number(point[1]) };
  }
  if (typeof value !== "string") return null;
  const match = value.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/i);
  if (match) return { longitude: Number(match[1]), latitude: Number(match[2]) };

  // Supabase may return PostGIS geography as little-endian EWKB hex.
  if (/^[0-9a-f]+$/i.test(value) && value.length >= 50) {
    const bytes = new Uint8Array(value.match(/../g)!.map((pair) => parseInt(pair, 16)));
    const view = new DataView(bytes.buffer);
    const littleEndian = bytes[0] === 1;
    const longitude = view.getFloat64(9, littleEndian);
    const latitude = view.getFloat64(17, littleEndian);
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) return { longitude, latitude };
  }

  return null;
}

function mode(mode?: string): JourneyLeg["mode"] {
  const value = mode?.toUpperCase();
  if (value === "WALK") return "walking";
  if (value === "BUS" || value === "COACH") return "coach";
  if (["TRAIN", "RAIL", "HIGHSPEED_RAIL", "REGIONAL_RAIL", "SUBURBAN"].includes(value ?? "")) return "train";
  return "local_transit";
}

async function routeTransfer(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  time: string,
  currency: string,
  arriveBy: boolean,
) {
  const params = new URLSearchParams({
    fromPlace: `${from.latitude},${from.longitude}`,
    toPlace: `${to.latitude},${to.longitude}`,
    time: transitousTime(time),
    arriveBy: arriveBy ? "true" : "false",
    // Airport journeys often need several changes, especially from a city
    // centre to Gatwick/Luton or from Malpensa into Milan.
    maxTransfers: "8",
    numItineraries: "1",
    maxItineraries: "1",
  });
  const requestDebug = {
    fromPlace: params.get("fromPlace"),
    toPlace: params.get("toPlace"),
    time: params.get("time"),
    arriveBy: params.get("arriveBy"),
    maxTransfers: params.get("maxTransfers"),
  };
  let response: Response;
  try {
    response = await fetch(`https://api.transitous.org/api/v6/plan?${params}`, {
      headers: { Accept: "application/json", "User-Agent": "TriPals/0.1 (hackathon prototype)" },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    return {
      legs: [] as JourneyLeg[],
      debug: {
        ...requestDebug,
        status: "timeout",
        body: error instanceof Error ? error.message : "Transitous request failed",
      },
    };
  }
  if (!response.ok) return { legs: [] as JourneyLeg[], debug: { ...requestDebug, status: response.status, body: (await response.text()).slice(0, 300) } };
  const payload = (await response.json()) as TransitousResponse;
  const legs = payload.itineraries?.[0]?.legs ?? [];
  return { legs: legs.map((leg): JourneyLeg => ({
    mode: mode(leg.mode),
    origin: leg.from?.name ?? "Airport",
    destination: leg.to?.name ?? "City centre",
    departureAt: leg.startTime,
    arrivalAt: leg.endTime,
    durationMinutes: Math.round((leg.duration ?? 0) / 60),
    priceMinor: 0,
    currency,
    operator: leg.route?.agencyName,
    serviceNumber: leg.route?.routeShortName,
    isEstimatedPrice: true,
    details: { provider: "transitous", fareAvailable: false, routeName: leg.route?.routeLongName },
  })), debug: { ...requestDebug, status: response.status, itineraryCount: payload.itineraries?.length ?? 0, legCount: legs.length } };
}

export async function addTransitousAirportTransfers(legs: JourneyLeg[], origin: LocationInput, destination: LocationInput, currency: string) {
  const flightIndex = legs.findIndex((leg) => leg.mode === "flight");
  if (flightIndex === -1) return legs;
  const flight = legs[flightIndex];
  const details = flight.details as { originAirportCode?: string; destinationAirportCode?: string } | undefined;
  const [departureAirport, arrivalAirport] = await Promise.all([
    getAirportByCode(details?.originAirportCode),
    getAirportByCode(details?.destinationAirportCode),
  ]);
  const originCoords = coordinates(origin.coordinates);
  const destinationCoords = coordinates(destination.coordinates);
  const departureCoords = coordinates(departureAirport?.coordinates);
  const arrivalCoords = coordinates(arrivalAirport?.coordinates);
  if (!originCoords || !destinationCoords || !departureCoords || !arrivalCoords) {
    const debug = {
      originAirportCode: details?.originAirportCode ?? null,
      destinationAirportCode: details?.destinationAirportCode ?? null,
      departureAirportFound: Boolean(departureAirport),
      arrivalAirportFound: Boolean(arrivalAirport),
      departureAirportCoordinatesFound: Boolean(departureCoords),
      arrivalAirportCoordinatesFound: Boolean(arrivalCoords),
      originCoordinatesFound: Boolean(originCoords),
      destinationCoordinatesFound: Boolean(destinationCoords),
    };
    return legs.map((leg, index) => index === flightIndex
      ? { ...leg, details: { ...leg.details, transferStatus: "Airport coordinates are missing in Supabase", transferDebug: debug } }
      : leg);
  }

  const departureTime = flight.departureAt ? new Date(new Date(flight.departureAt).getTime() - 2 * 60 * 60 * 1000).toISOString() : new Date().toISOString();
  const arrivalTime = flight.arrivalAt ?? new Date().toISOString();
  const debugBase = {
    originAirportCode: details?.originAirportCode,
    destinationAirportCode: details?.destinationAirportCode,
    departureAirportFound: Boolean(departureAirport),
    arrivalAirportFound: Boolean(arrivalAirport),
    originCoordinatesFound: Boolean(originCoords),
    destinationCoordinatesFound: Boolean(destinationCoords),
    departureAirportCoordinatesFound: Boolean(departureCoords),
    arrivalAirportCoordinatesFound: Boolean(arrivalCoords),
  };
  const [toAirport, fromAirport] = ENABLE_TRANSITOUS_AIRPORT_TRANSFERS
    ? await Promise.all([
      routeTransfer(originCoords, departureCoords, departureTime, currency, true),
      routeTransfer(arrivalCoords, destinationCoords, arrivalTime, currency, false),
    ])
    : [
      { legs: [] as JourneyLeg[], debug: { status: "disabled" } },
      { legs: [] as JourneyLeg[], debug: { status: "disabled" } },
    ];
  const [departureEstimate, arrivalEstimate] = await Promise.all([
    getAirportTransferEstimate(details?.originAirportCode, origin.code, "to_airport", currency),
    getAirportTransferEstimate(details?.destinationAirportCode, destination.code, "from_airport", currency),
  ]);
  const estimatedLeg = async (estimate: typeof departureEstimate, airportName: string, cityName: string, at: string | undefined, direction: "to_airport" | "from_airport"): Promise<JourneyLeg | null> => {
    if (!estimate) return null;
    const priceMinor = await convertMinorUnits(estimate.price_minor, estimate.currency, currency);
    return {
      mode: "airport_transfer",
      origin: direction === "to_airport" ? cityName : airportName,
      destination: direction === "to_airport" ? airportName : cityName,
      departureAt: at,
      durationMinutes: estimate.duration_minutes,
      priceMinor,
      currency,
      operator: estimate.operator ?? "Estimated airport transfer",
      isEstimatedPrice: true,
      details: { provider: "supabase-estimate", fareAvailable: false },
    };
  };
  const [departureEstimatedLeg, arrivalEstimatedLeg] = await Promise.all([
    estimatedLeg(departureEstimate, departureAirport?.name ?? details?.originAirportCode ?? "Departure airport", origin.name, departureTime, "to_airport"),
    estimatedLeg(arrivalEstimate, arrivalAirport?.name ?? details?.destinationAirportCode ?? "Arrival airport", destination.name, arrivalTime, "from_airport"),
  ]);
  const departureFallback = toAirport.legs.length || !departureEstimatedLeg ? [] : [departureEstimatedLeg];
  const arrivalFallback = fromAirport.legs.length || !arrivalEstimatedLeg ? [] : [arrivalEstimatedLeg];
  const departureLegs = toAirport.legs.length ? toAirport.legs : departureFallback;
  const arrivalLegs = fromAirport.legs.length ? fromAirport.legs : arrivalFallback;
  return [...legs.slice(0, flightIndex), ...departureLegs, { ...flight, details: { ...flight.details, transferStatus: departureLegs.length || arrivalLegs.length ? "Transitous route or estimated transfer" : "No airport transfer available", transferDebug: { ...debugBase, departureRoute: toAirport.debug, arrivalRoute: fromAirport.debug } } }, ...arrivalLegs, ...legs.slice(flightIndex + 1)];
}
