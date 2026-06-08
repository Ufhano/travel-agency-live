import { NextResponse } from "next/server";

import { insertClientDocument, validatePdfUpload } from "@backend/documents";
import { getSql } from "@backend/db";
import {
  allocatePaymentToTrips,
  type PaymentAllocation,
} from "@backend/payment-allocate";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const sql = getSql();

  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const form = await request.formData();
  const clientId =
    typeof form.get("clientId") === "string"
      ? String(form.get("clientId")).trim()
      : "";
  const totalAmountRaw = form.get("totalAmount");
  const allocationsRaw = form.get("allocations");

  if (!clientId) {
    return NextResponse.json({ error: "Client is required." }, { status: 400 });
  }

  const totalAmount =
    typeof totalAmountRaw === "string"
      ? Number(totalAmountRaw)
      : Number(totalAmountRaw);

  let allocations: PaymentAllocation[] = [];
  try {
    allocations = JSON.parse(
      typeof allocationsRaw === "string" ? allocationsRaw : "[]",
    ) as PaymentAllocation[];
  } catch {
    return NextResponse.json(
      { error: "Invalid allocations JSON." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return NextResponse.json(
      { error: "Proof of payment PDF is required." },
      { status: 400 },
    );
  }

  const typed = file as File;
  const pdfError = validatePdfUpload(typed);
  if (pdfError) {
    return NextResponse.json({ error: pdfError }, { status: 400 });
  }

  const buffer = Buffer.from(await typed.arrayBuffer());

  if (sql) {
    await insertClientDocument(
      sql,
      session.tenantId,
      clientId,
      "Payment allocation proof",
      typed.name || "proof.pdf",
      buffer,
    );
  }

  const result = await allocatePaymentToTrips(sql ?? null, session.tenantId, {
    clientId,
    totalAmount,
    allocations,
    method: "Allocation",
    note: "Multi-trip payment allocation",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    payments: result.payments,
    message: `Created ${result.payments.length} payment allocation(s).`,
  });
}
