import { NextResponse } from "next/server";

import { getSql } from "@backend/db";

export const runtime = "nodejs";

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
