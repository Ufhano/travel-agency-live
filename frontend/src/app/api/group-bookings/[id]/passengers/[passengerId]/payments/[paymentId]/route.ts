import { NextResponse } from "next/server";
import { deleteGroupSplitPassengerPayment } from "@backend/group-booking";
import { getSql } from "@backend/db";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; passengerId: string; paymentId: string }>;
};

export async function DELETE(
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
    return NextResponse.json(
      { error: "Group booking, passenger, and payment ids are required." },
      { status: 400 },
    );
  }

  try {
    const result = await deleteGroupSplitPassengerPayment(
      sql,
      session.tenantId,
      id,
      passengerId,
      paymentId,
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({ ok: true, groupStatus: result.groupStatus });
  } catch (e) {
    console.error(
      "[api/group-bookings/.../payments/[paymentId] DELETE]",
      e,
    );
    return NextResponse.json(
      { error: "Could not delete payment." },
      { status: 500 },
    );
  }
}
