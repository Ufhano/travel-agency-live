import { NextResponse } from "next/server";

import { getSql } from "@backend/db";
import type { ImportExtractResult } from "@backend/import-parse";
import { isSuperuser } from "@backend/roles";
import { saveImportExtractToNeon } from "@backend/import-save";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

type Body = {
  tripId?: string;
  rows?: ImportExtractResult[];
};

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isSuperuser(session.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      { error: "Database not configured. Set DATABASE_URL in frontend/.env.local." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const tripId = typeof body.tripId === "string" ? body.tripId.trim() : "";
  if (!tripId) {
    return NextResponse.json({ error: 'Missing "tripId".' }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Missing or empty "rows" array.' }, { status: 400 });
  }

  const saved: { clientId: string; paymentId?: string; paymentError?: string }[] = [];
  const failed: { index: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const r = await saveImportExtractToNeon(sql, session.tenantId, tripId, row);
    if (r.ok) {
      saved.push({
        clientId: r.clientId,
        paymentId: r.paymentId,
        paymentError: r.paymentError,
      });
    } else {
      failed.push({ index: i, error: r.error });
    }
  }

  return NextResponse.json({
    tripId,
    savedCount: saved.length,
    failedCount: failed.length,
    saved,
    failed,
  });
}
