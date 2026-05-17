import { NextResponse } from "next/server";

import { getSql } from "@backend/db";
import { createTripInNeon, parseCreateTripInput } from "@backend/trip-save";

export const runtime = "nodejs";

/** Create a departure (required before saving imported travellers). */
export async function POST(request: Request): Promise<Response> {
  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      { error: "Database not configured. Set DATABASE_URL." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseCreateTripInput(
    body && typeof body === "object" ? (body as Parameters<typeof parseCreateTripInput>[0]) : {},
  );
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const trip = await createTripInNeon(sql, parsed.trip);
    return NextResponse.json({ ok: true, trip }, { status: 201 });
  } catch (e) {
    console.error("[api/trips POST]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to create trip: ${message}` },
      { status: 500 },
    );
  }
}

/** Minimal trip list for assignment dropdowns (e.g. import save). */
export async function GET() {
  const sql = getSql();
  if (!sql) {
    return NextResponse.json({
      trips: [] as { id: string; name: string; destination: string; departureDate: string }[],
      mode: "static" as const,
      message: "DATABASE_URL not set — no trips to load.",
    });
  }

  const rows = (await sql`
    SELECT id, name, destination, departure_date
    FROM trips
    ORDER BY departure_date ASC
  `) as {
    id: string;
    name: string;
    destination: string;
    departure_date: string;
  }[];

  const trips = rows.map((r) => ({
    id: r.id,
    name: r.name,
    destination: r.destination,
    departureDate:
      typeof r.departure_date === "string"
        ? r.departure_date.slice(0, 10)
        : String(r.departure_date).slice(0, 10),
  }));

  return NextResponse.json({ trips, mode: "neon" as const });
}
