import { NextResponse } from "next/server";
import { searchJourneys } from "@/lib/journeys/engine";
import { demoFlightProvider, demoTrainProvider } from "@/lib/journeys/providers";
import { duffelFlightProvider } from "@/lib/journeys/duffel";
import type { SearchRequest } from "@/lib/journeys/types";
import { saveJourneySearch } from "@/lib/data/journeys";

const providers = [
  process.env.DUFFEL_API_TOKEN ? duffelFlightProvider : demoFlightProvider,
  // Transitous is intentionally disabled for now because public routing can
  // make searches take too long. The integration remains in the codebase.
  demoTrainProvider,
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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const allJourneys = [] as Awaited<ReturnType<typeof searchJourneys>>;
        const send = (payload: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        send({ type: "started" });
        try {
          await Promise.all(providers.map(async (provider) => {
            const journeys = await searchJourneys(searchRequest, [provider]);
            allJourneys.push(...journeys);
            send({ type: "journeys", journeys });
          }));
          const saved = await saveJourneySearch(searchRequest, allJourneys);
          send({ type: "complete", ...saved, request: searchRequest });
        } catch (error) {
          console.error("Journey search failed:", error);
          send({ type: "error", error: "Unable to search journeys" });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (error) {
    console.error("Journey search failed:", error);
    return NextResponse.json(
      {
        error: "Unable to search journeys",
        details: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined,
      },
      { status: 500 },
    );
  }
}
