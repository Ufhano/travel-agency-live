import { NextResponse } from "next/server";

import {
  createGroupBooking,
  listGroupBookings,
  parseCreateGroupBookingFormData,
} from "@backend/group-booking";
import { validatePdfUpload } from "@backend/documents";
import { getSql } from "@backend/db";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
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

  try {
    const groupBookings = await listGroupBookings(sql, session.tenantId);
    return NextResponse.json({ groupBookings });
  } catch (e) {
    console.error("[api/group-bookings GET]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to load group bookings: ${message}` },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
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

  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const form = await request.formData();
  const parsed = parseCreateGroupBookingFormData(form);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const file = form.get("file") as File;
  const pdfError = validatePdfUpload(file);
  if (pdfError) {
    return NextResponse.json({ error: pdfError }, { status: 400 });
  }

  const proofBuffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await createGroupBooking(
      sql as unknown as Parameters<typeof createGroupBooking>[0],
      session.tenantId,
      {
        ...parsed.input,
        proofFileName: file.name || "proof.pdf",
        proofBuffer,
      },
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(
      { ok: true, groupBooking: result.groupBooking },
      { status: 201 },
    );
  } catch (e) {
    console.error("[api/group-bookings POST]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to create group booking: ${message}` },
      { status: 500 },
    );
  }
}
