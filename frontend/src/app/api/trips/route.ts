import { NextResponse } from "next/server";

import { getSql } from "@backend/db";
import {
  clients as memoryClients,
  payments as memoryPayments,
  trips as memoryTrips,
} from "@backend/data";
import { memoryTripBelongsToTenant } from "@backend/tenant-access";
import { createTripInNeon, parseCreateTripInput } from "@backend/trip-save";
import { parseUpdateTripInput, updateTripInNeon } from "@backend/trip-update";
import type { Trip } from "@backend/types";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

/** Create a departure (required before saving imported travellers). */
export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

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
    const trip = await createTripInNeon(sql, session.tenantId, parsed.trip);
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
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const sql = getSql();
  if (!sql) {
    const trips = memoryTrips
      .filter((t) => memoryTripBelongsToTenant(t.id, session.tenantId))
      .map((t) => ({
        id: t.id,
        name: t.name,
        destination: t.destination,
        departureDate: t.departureDate,
      }));
    return NextResponse.json({ trips, mode: "static" as const });
  }

  const rows = (await sql`
    SELECT id, name, destination, departure_date
    FROM trips
    WHERE tenant_id = ${session.tenantId}
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

/** Update departure label / destination (e.g. fix import name like “Graskop”). */
export async function PATCH(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const sql = getSql();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseUpdateTripInput(
    body && typeof body === "object"
      ? (body as Parameters<typeof parseUpdateTripInput>[0])
      : {},
  );
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { id, patch } = parsed;

  if (!sql) {
    if (!memoryTripBelongsToTenant(id, session.tenantId)) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }
    const ix = memoryTrips.findIndex((t) => t.id === id);
    if (ix === -1) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }
    const cur = memoryTrips[ix]!;
    const updated: Trip = {
      ...cur,
      ...patch,
    };
    memoryTrips[ix] = updated;
    return NextResponse.json({ ok: true, trip: updated });
  }

  try {
    const trip = await updateTripInNeon(sql, session.tenantId, id, patch);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, trip });
  } catch (e) {
    console.error("[api/trips PATCH]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to update trip: ${message}` },
      { status: 500 },
    );
  }
}

/**
 * `DELETE /api/trips?tripId=…` — remove a departure and everything linked to it
 * (travellers, payments and group bookings cascade via foreign keys).
 */
export async function DELETE(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tripId = searchParams.get("tripId")?.trim() ?? "";
  if (!tripId) {
    return NextResponse.json({ error: "tripId is required." }, { status: 400 });
  }

  const sql = getSql();

  if (!sql) {
    if (!memoryTripBelongsToTenant(tripId, session.tenantId)) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }
    const ix = memoryTrips.findIndex((t) => t.id === tripId);
    if (ix === -1) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }
    const removedClientIds = new Set(
      memoryClients.filter((c) => c.tripId === tripId).map((c) => c.id),
    );
    for (let i = memoryPayments.length - 1; i >= 0; i--) {
      if (
        memoryPayments[i]!.tripId === tripId ||
        removedClientIds.has(memoryPayments[i]!.clientId)
      ) {
        memoryPayments.splice(i, 1);
      }
    }
    for (let i = memoryClients.length - 1; i >= 0; i--) {
      if (memoryClients[i]!.tripId === tripId) memoryClients.splice(i, 1);
    }
    memoryTrips.splice(ix, 1);
    return NextResponse.json({ ok: true });
  }

  try {
    const rows = (await sql`
      DELETE FROM trips
      WHERE id = ${tripId} AND tenant_id = ${session.tenantId}
      RETURNING id
    `) as Array<{ id: string }>;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/trips DELETE]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to delete trip: ${message}` },
      { status: 500 },
    );
  }
}
