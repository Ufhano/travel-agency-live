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
  const methodRaw = form.get("method");
  const noteRaw = form.get("note");
  const method =
    typeof methodRaw === "string" && methodRaw.trim()
      ? methodRaw.trim()
      : "Allocation";
  const note =
    typeof noteRaw === "string" && noteRaw.trim()
      ? noteRaw.trim()
      : "Multi-trip payment allocation";

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
  const hasFile =
    file &&
    typeof file === "object" &&
    "arrayBuffer" in file &&
    (file as File).size > 0;

  let proof: { fileName: string; buffer: Buffer } | null = null;
  if (hasFile) {
    const typed = file as File;
    const pdfError = validatePdfUpload(typed);
    if (pdfError) {
      return NextResponse.json({ error: pdfError }, { status: 400 });
    }
    proof = {
      fileName: typed.name || "proof.pdf",
      buffer: Buffer.from(await typed.arrayBuffer()),
    };
  }

  const result = await allocatePaymentToTrips(sql ?? null, session.tenantId, {
    clientId,
    totalAmount,
    allocations,
    method,
    note,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Attach the proof PDF to each created payment so it is accessible next to
  // the matching receipt in the traveller's payment history.
  if (proof && sql && result.payments.length > 0) {
    for (const created of result.payments) {
      await insertClientDocument(
        sql,
        session.tenantId,
        clientId,
        "Payment allocation proof",
        proof.fileName,
        proof.buffer,
        created.paymentId,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    payments: result.payments,
    message: `Created ${result.payments.length} payment allocation(s).`,
  });
}
