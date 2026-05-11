import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSql } from "@backend/db";
import { clients as memoryClients, trips as memoryTrips } from "@backend/data";
import type { Client } from "@backend/types";

export const runtime = "nodejs";

type NewClientInput = {
  tripId?: unknown;
  fullName?: unknown;
  phone?: unknown;
  email?: unknown;
  packagePrice?: unknown;
  balanceDueDate?: unknown;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
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

  const tripId = asString(body.tripId);
  const fullName = asString(body.fullName);
  const phone = asString(body.phone);
  const email = asString(body.email);
  const balanceDueDate = asString(body.balanceDueDate);
  const priceRaw =
    typeof body.packagePrice === "number"
      ? body.packagePrice
      : Number(asString(body.packagePrice));

  if (!tripId) return badRequest("Trip is required.");
  if (!fullName) return badRequest("Full name is required.");
  if (!phone) return badRequest("Phone is required.");
  if (!email || !EMAIL_RE.test(email))
    return badRequest("A valid email is required.");
  if (!Number.isFinite(priceRaw) || priceRaw <= 0)
    return badRequest("Package price must be a positive number.");
  if (!ISO_DATE_RE.test(balanceDueDate))
    return badRequest("Balance due date must be in YYYY-MM-DD format.");

  const packagePrice = Math.round(priceRaw);
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
