import { NextResponse } from "next/server";

import { getSql } from "@backend/db";
import {
  defaultInvoiceTermsConfig,
  getInvoiceTermsConfig,
  parseInvoiceTermsConfigInput,
  parseInvoiceTermsInput,
  setInvoiceTermsConfig,
  upsertInvoiceTermsForTrip,
} from "@backend/invoice-terms";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

/** Current tenant's invoice terms (default + trip-specific sets). */
export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const config = await getInvoiceTermsConfig(getSql(), session.tenantId);
    return NextResponse.json(config);
  } catch (e) {
    console.error("[api/settings/invoice-terms GET]", e);
    return NextResponse.json(defaultInvoiceTermsConfig());
  }
}

/** Replace the full invoice terms configuration. */
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

  const parsed = parseInvoiceTermsConfigInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await setInvoiceTermsConfig(getSql(), session.tenantId, parsed.config);
    return NextResponse.json({ ok: true, ...parsed.config });
  } catch (e) {
    console.error("[api/settings/invoice-terms PUT]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to save terms: ${message}` },
      { status: 500 },
    );
  }
}

/** Update terms for a single trip (inline invoice edit) or default when tripId is null. */
export async function PATCH(request: Request): Promise<Response> {
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

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const obj = body as Record<string, unknown>;
  const rawTerms = obj.terms;
  const parsedTerms = parseInvoiceTermsInput(rawTerms);
  if (!parsedTerms.ok) {
    return NextResponse.json({ error: parsedTerms.error }, { status: 400 });
  }

  const tripId =
    obj.tripId === null || obj.tripId === undefined
      ? null
      : typeof obj.tripId === "string" && obj.tripId.trim()
        ? obj.tripId.trim()
        : null;
  const label = typeof obj.label === "string" ? obj.label.trim() : undefined;

  try {
    const sql = getSql();
    if (tripId) {
      const config = await upsertInvoiceTermsForTrip(
        sql,
        session.tenantId,
        tripId,
        parsedTerms.terms,
        label,
      );
      return NextResponse.json({ ok: true, ...config });
    }

    const config = await getInvoiceTermsConfig(sql, session.tenantId);
    config.defaultTerms = parsedTerms.terms;
    await setInvoiceTermsConfig(sql, session.tenantId, config);
    return NextResponse.json({ ok: true, ...config });
  } catch (e) {
    console.error("[api/settings/invoice-terms PATCH]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to save terms: ${message}` },
      { status: 500 },
    );
  }
}

/** Reset all invoice terms back to the default template. */
export async function DELETE(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const config = defaultInvoiceTermsConfig();
    await setInvoiceTermsConfig(getSql(), session.tenantId, config);
    return NextResponse.json({ ok: true, ...config });
  } catch (e) {
    console.error("[api/settings/invoice-terms DELETE]", e);
    const message = e instanceof Error ? e.message : "Unknown database error.";
    return NextResponse.json(
      { error: `Failed to reset terms: ${message}` },
      { status: 500 },
    );
  }
}
