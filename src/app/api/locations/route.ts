import { NextResponse } from "next/server";
import { getCities } from "@/lib/data/locations";

export async function GET() {
  try {
    return NextResponse.json({ cities: await getCities() });
  } catch {
    return NextResponse.json({ error: "Unable to load cities" }, { status: 500 });
  }
}
