import { NextResponse } from "next/server";
import { searchJourneys } from "@/lib/journeys/engine";
import { demoCoachProvider, demoFlightProvider, demoTrainProvider } from "@/lib/journeys/providers";
import type { SearchRequest } from "@/lib/journeys/types";

const providers = [demoFlightProvider, demoTrainProvider, demoCoachProvider];

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
    return NextResponse.json({ request: searchRequest, journeys });
  } catch {
    return NextResponse.json({ error: "Unable to search journeys" }, { status: 500 });
  }
}
