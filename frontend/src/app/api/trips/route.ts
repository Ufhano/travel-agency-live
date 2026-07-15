import { NextResponse } from "next/server";

import { getSql } from "@backend/db";
import {
  clients as memoryClients,
  payments as memoryPayments,
  trips as memoryTrips,
} from "@backend/data";
import { memoryTripBelongsToTenant } from "@backend/tenant-access";
import { createTripInNeon, parseCreateTripInput } from "@backend/trip-save";
import {
  parseUpdateTripInput,
  syncTripFieldsForDepartureChange,
  updateTripInNeon,
} from "@backend/trip-update";
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

  const trips = rows.map((r) => {
    const departureDate =
      typeof r.departure_date === "string"
        ? r.departure_date.slice(0, 10)
        : r.departure_date instanceof Date
          ? `${r.departure_date.getFullYear()}-${String(r.departure_date.getMonth() + 1).padStart(2, "0")}-${String(r.departure_date.getDate()).padStart(2, "0")}`
          : String(r.departure_date).slice(0, 10);
    return {
      id: r.id,
      name: r.name,
      destination: r.destination,
      departureDate,
    };
  });

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
    let name = patch.name ?? cur.name;
    let destination = patch.destination ?? cur.destination;
    const departureDate = patch.departureDate ?? cur.departureDate;

    if (patch.departureDate !== undefined) {
      const synced = syncTripFieldsForDepartureChange({
        name,
        destination,
        oldDepartureDate: cur.departureDate,
        newDepartureDate: departureDate,
      });
      if (patch.name === undefined) name = synced.name;
      if (patch.destination === undefined) destination = synced.destination;

      for (const oldDue of synced.balanceDueDatesToRewrite) {
        if (oldDue === departureDate) continue;
        for (const client of memoryClients) {
          if (
            client.tripId === id &&
            client.balanceDueDate.slice(0, 10) === oldDue
          ) {
            client.balanceDueDate = departureDate;
          }
        }
      }
    }

    const updated: Trip = {
      ...cur,
      ...patch,
      name,
      destination,
      departureDate,
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
