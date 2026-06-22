import { NextResponse } from "next/server";

import { getPaymentProofDocument } from "@backend/documents";
import { getSql } from "@backend/db";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ paymentId: string }> };

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

  const { paymentId } = await context.params;
  if (!paymentId?.trim()) {
    return NextResponse.json(
      { error: "Payment id is required." },
      { status: 400 },
    );
  }

  try {
    const doc = await getPaymentProofDocument(sql, session.tenantId, paymentId);
    if (!doc) {
      return NextResponse.json(
        { error: "Proof of payment not found." },
        { status: 404 },
      );
    }

    return new NextResponse(new Uint8Array(doc.buffer), {
      status: 200,
      headers: {
        "Content-Type": doc.contentType,
        "Content-Disposition": `inline; filename="${doc.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[api/payments/[paymentId]/proof GET]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to load proof: ${message}` },
      { status: 500 },
    );
  }
}
