import { NextResponse } from "next/server";

import { getSql } from "@backend/db";
import {
  DEFAULT_INVOICE_TERMS,
  getInvoiceTerms,
  parseInvoiceTermsInput,
  setInvoiceTerms,
} from "@backend/invoice-terms";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

/** Current tenant's invoice "Terms and Conditions" lines. */
export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const terms = await getInvoiceTerms(getSql(), session.tenantId);
    return NextResponse.json({ terms });
  } catch (e) {
    console.error("[api/settings/invoice-terms GET]", e);
    return NextResponse.json({ terms: [...DEFAULT_INVOICE_TERMS] });
  }
}

/** Replace the current tenant's invoice terms. */
export async function PUT(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawTerms =
    body && typeof body === "object" && "terms" in body
      ? (body as { terms: unknown }).terms
      : undefined;
  const parsed = parseInvoiceTermsInput(rawTerms);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await setInvoiceTerms(getSql(), session.tenantId, parsed.terms);
    return NextResponse.json({ ok: true, terms: parsed.terms });
  } catch (e) {
    console.error("[api/settings/invoice-terms PUT]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to save terms: ${message}` },
      { status: 500 },
    );
  }
}

/** Reset the current tenant's invoice terms back to the default template. */
export async function DELETE(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await setInvoiceTerms(getSql(), session.tenantId, [
      ...DEFAULT_INVOICE_TERMS,
    ]);
    return NextResponse.json({ ok: true, terms: [...DEFAULT_INVOICE_TERMS] });
  } catch (e) {
    console.error("[api/settings/invoice-terms DELETE]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to reset terms: ${message}` },
      { status: 500 },
    );
  }
}
