import { NextResponse } from "next/server";

import {
  getGroupBookingById,
  listGroupBookingFollowUpPayments,
  updateGroupBookingPackagePrice,
} from "@backend/group-booking";
import { getSql } from "@backend/db";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
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

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Group booking id is required." }, { status: 400 });
  }

  try {
    const groupBooking = await getGroupBookingById(sql, session.tenantId, id);
    if (!groupBooking) {
      return NextResponse.json({ error: "Group booking not found." }, { status: 404 });
    }
    const followUpPayments = await listGroupBookingFollowUpPayments(
      sql,
      session.tenantId,
      id,
    );
    return NextResponse.json({ groupBooking, followUpPayments });
  } catch (e) {
    console.error("[api/group-bookings/[id] GET]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to load group booking: ${message}` },
      { status: 500 },
    );
  }
}

/** Update package price per person for all passengers on this group booking. */
export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
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

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Group booking id is required." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw =
    body && typeof body === "object"
      ? (body as { packagePricePerPerson?: unknown }).packagePricePerPerson
      : undefined;
  const packagePrice =
    typeof raw === "number" ? raw : Number(String(raw ?? "").trim());

  if (!Number.isFinite(packagePrice) || packagePrice <= 0) {
    return NextResponse.json(
      { error: "packagePricePerPerson must be a positive number." },
      { status: 400 },
    );
  }

  try {
    const result = await updateGroupBookingPackagePrice(
      sql,
      session.tenantId,
      id,
      packagePrice,
    );
    if (!result.ok) {
      const status = result.error.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    const groupBooking = await getGroupBookingById(sql, session.tenantId, id);
    return NextResponse.json({
      ok: true,
      packagePrice: result.packagePrice,
      groupStatus: result.groupStatus,
      groupBooking,
    });
  } catch (e) {
    console.error("[api/group-bookings/[id] PATCH]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to update package price: ${message}` },
      { status: 500 },
    );
  }
}
