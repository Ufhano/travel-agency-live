import { NextResponse } from "next/server";
import { createCompute } from "@backend/compute";
import { loadAppData } from "@backend/load-app-data";
import { sendInvoiceEmailWithPdf } from "@backend/send-invoice-email";
import { getSession } from "@/lib/auth-server";
import { hasRealClientEmail } from "@/lib/utils";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 8 * 1024 * 1024;

export async function POST(
  request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { paymentId } = await context.params;
  const { data: app } = await loadAppData(session.tenantId);
  const { enrichPayment, getPaymentById } = createCompute(app);
  const payment = getPaymentById(paymentId);
  if (!payment) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const ctx = enrichPayment(payment);
  if (!ctx) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const email = ctx.client.email.trim();
  if (!hasRealClientEmail(email)) {
    return NextResponse.json(
      { error: "No email on record for this client." },
      { status: 400 },
    );
  }

  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data with PDF." },
      { status: 400 },
    );
  }

  const form = await request.formData();
  const file = form.get("pdf");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return NextResponse.json({ error: 'Missing form field "pdf".' }, { status: 400 });
  }

  const typed = file as File;
  if (typed.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "PDF too large (max 8 MB)." }, { status: 413 });
  }

  const buffer = Buffer.from(await typed.arrayBuffer());
  const pdfBase64 = buffer.toString("base64");
  const filename =
    typeof form.get("filename") === "string" && String(form.get("filename")).trim()
      ? String(form.get("filename")).trim()
      : `Invoice-${ctx.invoiceNumber}.pdf`;

  try {
    const result = await sendInvoiceEmailWithPdf({
      to: email,
      clientName: ctx.client.fullName,
      invoiceNumber: ctx.invoiceNumber,
      tripName: ctx.trip.name,
      pdfBase64,
      filename,
    });

    if (result.mode === "unconfigured") {
      return NextResponse.json(
        {
          error:
            "Email is not configured. Set RESEND_API_KEY and EMAIL_FROM in Vercel.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Invoice PDF sent to ${result.to}.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send email.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
