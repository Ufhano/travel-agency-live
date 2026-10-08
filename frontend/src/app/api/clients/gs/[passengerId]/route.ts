import { NextResponse } from "next/server";
import { getSql } from "@backend/db";
import {
  deleteGroupSplitPassenger,
  updateGroupSplitPassengerContact,
} from "@backend/group-booking";
import { getSession } from "@/lib/auth-server";

type RouteContext = { params: Promise<{ passengerId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const { passengerId } = await context.params;
  if (!passengerId?.trim()) {
    return NextResponse.json({ error: "Passenger id required." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = body as {
    passengerName?: unknown;
    passengerEmail?: unknown;
    passengerPhone?: unknown;
    passengerIdNumber?: unknown;
  };

  const input: {
    passengerName?: string;
    passengerEmail?: string;
    passengerPhone?: string;
    passengerIdNumber?: string | null;
  } = {};

  if (raw.passengerName !== undefined) {
    input.passengerName =
      typeof raw.passengerName === "string" ? raw.passengerName : "";
  }

  if (raw.passengerEmail !== undefined) {
    input.passengerEmail =
      typeof raw.passengerEmail === "string" ? raw.passengerEmail : "";
  }
  if (raw.passengerPhone !== undefined) {
    input.passengerPhone =
      typeof raw.passengerPhone === "string" ? raw.passengerPhone : "";
  }
  if (raw.passengerIdNumber !== undefined) {
    if (raw.passengerIdNumber == null) {
      input.passengerIdNumber = null;
    } else if (typeof raw.passengerIdNumber === "string") {
      input.passengerIdNumber = raw.passengerIdNumber;
    } else {
      input.passengerIdNumber = null;
    }
  }

  try {
    const result = await updateGroupSplitPassengerContact(
      sql,
      session.tenantId,
      passengerId,
      input,
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ passenger: result.passenger });
  } catch (e) {
    console.error("[api/clients/gs/[passengerId] PATCH]", e);
    return NextResponse.json(
      { error: "Could not update passenger." },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const { passengerId } = await context.params;
  if (!passengerId?.trim()) {
    return NextResponse.json({ error: "Passenger id required." }, { status: 400 });
  }

  try {
    const result = await deleteGroupSplitPassenger(
      sql,
      session.tenantId,
      passengerId,
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/clients/gs/[passengerId] DELETE]", e);
    return NextResponse.json(
      { error: "Could not delete passenger." },
      { status: 500 },
    );
  }
}
