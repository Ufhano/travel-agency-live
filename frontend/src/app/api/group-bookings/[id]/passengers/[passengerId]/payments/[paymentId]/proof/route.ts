import { NextResponse } from "next/server";

import { getGroupBookingPassengerPaymentProofDocument } from "@backend/documents";
import { getSql } from "@backend/db";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; passengerId: string; paymentId: string }>;
};

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

  const { id, passengerId, paymentId } = await context.params;
  if (!id?.trim() || !passengerId?.trim() || !paymentId?.trim()) {
    return NextResponse.json({ error: "Missing route parameters." }, { status: 400 });
  }

  try {
    const ownership = (await sql`
      SELECT p.id
      FROM group_booking_passenger_payments p
      JOIN group_booking_passengers gbp ON gbp.id = p.passenger_id
      JOIN group_bookings gb ON gb.id = gbp.group_booking_id
      WHERE p.id = ${paymentId}
        AND gbp.id = ${passengerId}
        AND gb.id = ${id}
        AND p.tenant_id = ${session.tenantId}
      LIMIT 1
    `) as { id: string }[];

    if (!ownership[0]) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    const doc = await getGroupBookingPassengerPaymentProofDocument(
      sql,
      session.tenantId,
      paymentId,
    );
    if (!doc) {
      return NextResponse.json({ error: "No proof uploaded." }, { status: 404 });
    }

    return new Response(new Uint8Array(doc.buffer), {
      status: 200,
      headers: {
        "Content-Type": doc.contentType,
        "Content-Disposition": `inline; filename="${doc.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error(
      "[api/group-bookings/.../payments/[paymentId]/proof GET]",
      e,
    );
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to load proof: ${message}` },
      { status: 500 },
    );
  }
}
