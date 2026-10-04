import { NextResponse } from "next/server";
import { searchJourneys } from "@/lib/journeys/engine";
import { demoCoachProvider, demoFlightProvider, demoTrainProvider } from "@/lib/journeys/providers";
import { duffelFlightProvider } from "@/lib/journeys/duffel";
import type { SearchRequest } from "@/lib/journeys/types";
import { saveJourneySearch } from "@/lib/data/journeys";

const providers = [
  process.env.DUFFEL_API_TOKEN ? duffelFlightProvider : demoFlightProvider,
  demoTrainProvider,
  demoCoachProvider,
];


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
    const saved = await saveJourneySearch(searchRequest, journeys);
    return NextResponse.json({ ...saved, request: searchRequest });
  } catch {
    return NextResponse.json({ error: "Unable to search journeys" }, { status: 500 });
  }
}
