import { NextResponse } from "next/server";

import { ensureTripsForImportGroups } from "@backend/ensure-import-trips";
import { getSql } from "@backend/db";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

type Body = {
  groups?: unknown;
};

/** Create missing departures from import group / sheet labels. */
export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const groups = Array.isArray(body.groups)
    ? body.groups.filter((g): g is string => typeof g === "string")
    : [];

  if (groups.length === 0) {
    return NextResponse.json({ error: "No groups provided." }, { status: 400 });
  }

  try {
    const result = await ensureTripsForImportGroups(
      sql,
      session.tenantId,
      groups,
    );
    return NextResponse.json({
      ok: true,
      trips: result.trips,
      groupTripIds: result.groupTripIds,
      createdCount: result.createdCount,
      createdNames: result.createdNames,
    });
  } catch (e) {
    console.error("[api/trips/ensure-from-import]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to sync departures: ${message}` },
      { status: 500 },
    );
  }
}
