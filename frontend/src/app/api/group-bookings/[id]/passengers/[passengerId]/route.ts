import { NextResponse } from "next/server";

import { updatePassengerPaidStatus } from "@backend/group-booking";
import { getSql } from "@backend/db";
import type { PassengerPaidStatus } from "@backend/types";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; passengerId: string }> };

function parsePaidStatus(raw: unknown): PassengerPaidStatus | null {
  if (raw === "paid" || raw === "unpaid") return raw;
  return null;
}

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

  const { id, passengerId } = await context.params;
  if (!id?.trim() || !passengerId?.trim()) {
    return NextResponse.json(
      { error: "Group booking id and passenger id are required." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const paidStatus = parsePaidStatus(
    body && typeof body === "object"
      ? (body as Record<string, unknown>).paidStatus
      : undefined,
  );
  if (!paidStatus) {
    return NextResponse.json(
      { error: "paidStatus must be 'paid' or 'unpaid'." },
      { status: 400 },
    );
  }

  try {
    const result = await updatePassengerPaidStatus(
      sql,
      session.tenantId,
      id,
      passengerId,
      paidStatus,
    );
    if (!result.ok) {
      const status = result.error.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({
      ok: true,
      passenger: result.passenger,
      groupStatus: result.groupStatus,
    });
  } catch (e) {
    console.error("[api/group-bookings/[id]/passengers/[passengerId] PATCH]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to update passenger: ${message}` },
      { status: 500 },
    );
  }
}
