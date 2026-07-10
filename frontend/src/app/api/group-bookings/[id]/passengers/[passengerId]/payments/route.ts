import { NextResponse } from "next/server";

import {
  listGroupBookingFollowUpPayments,
  recordPassengerPayment,
} from "@backend/group-booking";
import { validatePdfUpload } from "@backend/documents";
import { getSql } from "@backend/db";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; passengerId: string }> };

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

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

  const { id, passengerId } = await context.params;
  if (!id?.trim() || !passengerId?.trim()) {
    return NextResponse.json(
      { error: "Group booking id and passenger id are required." },
      { status: 400 },
    );
  }

  try {
    const allPayments = await listGroupBookingFollowUpPayments(
      sql,
      session.tenantId,
      id,
    );
    const payments = allPayments.filter((p) => p.passengerId === passengerId);
    return NextResponse.json({ payments });
  } catch (e) {
    console.error(
      "[api/group-bookings/[id]/passengers/[passengerId]/payments GET]",
      e,
    );
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to load payments: ${message}` },
      { status: 500 },
    );
  }
}

export async function POST(
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

  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const form = await request.formData();
  const amountRaw = form.get("amount");
  const amount =
    typeof amountRaw === "string" ? Number(amountRaw) : Number(amountRaw);
  const paidAt =
    typeof form.get("paidAt") === "string"
      ? String(form.get("paidAt")).trim()
      : todayIsoDate();
  const note =
    typeof form.get("note") === "string" ? String(form.get("note")).trim() : "";

  const file = form.get("file");
  let proofFileName: string | undefined;
  let proofBuffer: Buffer | undefined;

  if (file && typeof file === "object" && "arrayBuffer" in file) {
    const typedFile = file as File;
    const pdfError = validatePdfUpload(typedFile);
    if (pdfError) {
      return NextResponse.json({ error: pdfError }, { status: 400 });
    }
    proofFileName = typedFile.name || "proof.pdf";
    proofBuffer = Buffer.from(await typedFile.arrayBuffer());
  }

  try {
    const result = await recordPassengerPayment(
      sql,
      session.tenantId,
      id,
      passengerId,
      {
        amount,
        paidAt,
        note: note || undefined,
        proofFileName,
        proofBuffer,
      },
    );
    if (!result.ok) {
      const status = result.error.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({
      ok: true,
      passenger: result.passenger,
      payment: result.payment,
      groupStatus: result.groupStatus,
    });
  } catch (e) {
    console.error(
      "[api/group-bookings/[id]/passengers/[passengerId]/payments POST]",
      e,
    );
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to record payment: ${message}` },
      { status: 500 },
    );
  }
}
