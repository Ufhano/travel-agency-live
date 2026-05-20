import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  deleteClientById,
  deleteClientsByDestination,
  deleteClientsByTripId,
} from "@backend/client-delete";
import { clients as memoryClients, payments as memoryPayments, trips as memoryTrips } from "@backend/data";
import { getSql } from "@backend/db";
import type { Client } from "@backend/types";

export const runtime = "nodejs";

type NewClientInput = {
  id?: unknown;
  tripId?: unknown;
  fullName?: unknown;
  phone?: unknown;
  email?: unknown;
  packagePrice?: unknown;
  balanceDueDate?: unknown;
};

type ClientUpsertFields = {
  tripId: string;
  fullName: string;
  phone: string;
  email: string;
  packagePrice: number;
  balanceDueDate: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseClientUpsertFields(body: NewClientInput):
  | { ok: true; fields: ClientUpsertFields }
  | { ok: false; error: string } {
  const tripId = asString(body.tripId);
  const fullName = asString(body.fullName);
  const phone = asString(body.phone);
  const email = asString(body.email);
  const balanceDueDate = asString(body.balanceDueDate);
  const priceRaw =
    typeof body.packagePrice === "number"
      ? body.packagePrice
      : Number(asString(body.packagePrice));

  if (!tripId) return { ok: false, error: "Trip is required." };
  if (!fullName) return { ok: false, error: "Full name is required." };
  if (!phone) return { ok: false, error: "Phone is required." };
  if (!email || !EMAIL_RE.test(email))
    return { ok: false, error: "A valid email is required." };
  if (!Number.isFinite(priceRaw) || priceRaw <= 0)
    return { ok: false, error: "Package price must be a positive number." };
  if (!ISO_DATE_RE.test(balanceDueDate))
    return {
      ok: false,
      error: "Balance due date must be in YYYY-MM-DD format.",
    };

  return {
    ok: true,
    fields: {
      tripId,
      fullName,
      phone,
      email,
      packagePrice: Math.round(priceRaw),
      balanceDueDate,
    },
  };
}

/**
 * `POST /api/clients` — create a new traveller bound to an existing trip.
 * Writes to Neon when `DATABASE_URL` is set; otherwise appends to the
 * in-memory fallback (visible while the dev process is alive).
 */
export async function POST(request: Request): Promise<Response> {
  let body: NewClientInput;
  try {
    body = (await request.json()) as NewClientInput;
  } catch {
    return badRequest("Body must be valid JSON.");
  }

  const parsed = parseClientUpsertFields(body);
  if (!parsed.ok) return badRequest(parsed.error);
  const { tripId, fullName, phone, email, packagePrice, balanceDueDate } =
    parsed.fields;
  const id = `c-${randomUUID()}`;

  const newClient: Client = {
    id,
    tripId,
    fullName,
    phone,
    email,
    packagePrice,
    balanceDueDate,
  };

  const sql = getSql();

  if (!sql) {
    const tripExists = memoryTrips.some((t) => t.id === tripId);
    if (!tripExists)
      return badRequest("Selected trip does not exist (in-memory store).");
    memoryClients.push(newClient);
    return NextResponse.json({ ok: true, client: newClient }, { status: 201 });
  }

  try {
    const tripRows = (await sql`
      SELECT id FROM trips WHERE id = ${tripId} LIMIT 1
    `) as Array<{ id: string }>;
    if (tripRows.length === 0)
      return badRequest("Selected trip does not exist.");

    await sql`
      INSERT INTO clients
        (id, trip_id, full_name, phone, email, package_price, balance_due_date)
      VALUES
        (${id}, ${tripId}, ${fullName}, ${phone}, ${email}, ${packagePrice}, ${balanceDueDate})
    `;

    return NextResponse.json({ ok: true, client: newClient }, { status: 201 });
  } catch (e) {
    console.error("[api/clients]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to save client: ${message}` },
      { status: 500 },
    );
  }
}

/**
 * `PATCH /api/clients` — update an existing traveller (same payload as POST plus `id`).
 * When `tripId` changes, linked payment rows are updated to the new departure.
 */
export async function PATCH(request: Request): Promise<Response> {
  let body: NewClientInput;
  try {
    body = (await request.json()) as NewClientInput;
  } catch {
    return badRequest("Body must be valid JSON.");
  }

  const clientId = asString(body.id);
  if (!clientId) return badRequest("Client id is required.");

  const parsed = parseClientUpsertFields(body);
  if (!parsed.ok) return badRequest(parsed.error);
  const { tripId, fullName, phone, email, packagePrice, balanceDueDate } =
    parsed.fields;

  const sql = getSql();

  if (!sql) {
    const ix = memoryClients.findIndex((c) => c.id === clientId);
    if (ix === -1)
      return NextResponse.json({ error: "Client not found." }, { status: 404 });

    const tripExists = memoryTrips.some((t) => t.id === tripId);
    if (!tripExists)
      return badRequest("Selected trip does not exist (in-memory store).");

    const prevTripId = memoryClients[ix]!.tripId;
    const updated: Client = {
      id: clientId,
      tripId,
      fullName,
      phone,
      email,
      packagePrice,
      balanceDueDate,
    };
    memoryClients[ix] = updated;

    if (tripId !== prevTripId) {
      for (const p of memoryPayments) {
        if (p.clientId === clientId) p.tripId = tripId;
      }
    }

    return NextResponse.json({ ok: true, client: updated });
  }

  try {
    const existing = (await sql`
      SELECT id, trip_id FROM clients WHERE id = ${clientId} LIMIT 1
    `) as Array<{ id: string; trip_id: string }>;
    if (existing.length === 0)
      return NextResponse.json({ error: "Client not found." }, { status: 404 });

    const prevTripId = existing[0]!.trip_id;

    const tripRows = (await sql`
      SELECT id FROM trips WHERE id = ${tripId} LIMIT 1
    `) as Array<{ id: string }>;
    if (tripRows.length === 0)
      return badRequest("Selected trip does not exist.");

    await sql`
      UPDATE clients
      SET
        trip_id = ${tripId},
        full_name = ${fullName},
        phone = ${phone},
        email = ${email},
        package_price = ${packagePrice},
        balance_due_date = ${balanceDueDate}
      WHERE id = ${clientId}
    `;

    if (tripId !== prevTripId) {
      await sql`
        UPDATE payments
        SET trip_id = ${tripId}
        WHERE client_id = ${clientId}
      `;
    }

    const updated: Client = {
      id: clientId,
      tripId,
      fullName,
      phone,
      email,
      packagePrice,
      balanceDueDate,
    };

    return NextResponse.json({ ok: true, client: updated });
  } catch (e) {
    console.error("[api/clients PATCH]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to update client: ${message}` },
      { status: 500 },
    );
  }
}

/**
 * `DELETE /api/clients?clientId=…` — one traveller.
 * `DELETE /api/clients?tripId=…` — all travellers on a departure.
 * `DELETE /api/clients?destination=…` — all travellers on trips with that destination.
 */
export async function DELETE(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId")?.trim() ?? "";
  const tripId = searchParams.get("tripId")?.trim() ?? "";
  const destination = searchParams.get("destination")?.trim() ?? "";

  const modes = [clientId, tripId, destination].filter(Boolean);
  if (modes.length !== 1) {
    return badRequest(
      "Provide exactly one query parameter: clientId, tripId, or destination.",
    );
  }

  const result = clientId
    ? await deleteClientById(clientId)
    : tripId
      ? await deleteClientsByTripId(tripId)
      : await deleteClientsByDestination(destination);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    deletedCount: result.deletedCount,
  });
}
