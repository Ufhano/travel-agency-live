import { NextResponse } from "next/server";

import { getGroupBookingById, listGroupBookingFollowUpPayments } from "@backend/group-booking";
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
