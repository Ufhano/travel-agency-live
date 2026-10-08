import { randomUUID } from "node:crypto";

import { getSql } from "./db";
import { nextInvoiceNumber } from "./invoice-number";
import { getPublicTenantId } from "./public-config";
import { centsToZar, createYocoCheckout, zarToCents } from "./yoco";
import { metadataString, type YocoWebhookEvent } from "./yoco-webhook";
import { sendBookingConfirmationEmail } from "./send-booking-confirmation-email";
import { ensureTripReturnDateSchema } from "./trip-update";

type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

export type FeaturedTrip = {
  id: string;
  tenantId: string;
  name: string;
  destination: string;
  departureDate: string;
  returnDate: string | null;
  capacity: number;
  status: string;
  accommodationNote: string;
  publicPackagePrice: number;
  heroImageUrl: string | null;
  galleryUrls: string[];
};

type TripRow = {
  id: string;
  tenant_id: string;
  name: string;
  destination: string;
  departure_date: string | Date;
  return_date: string | Date | null;
  capacity: number;
  status: string;
  accommodation_note: string;
  public_package_price: number | null;
  hero_image_url: string | null;
  gallery_urls: unknown;
  is_featured: boolean;
};

function isoDate(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function parseGalleryUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
}

function mapTripRow(row: TripRow): FeaturedTrip | null {
  const price = row.public_package_price;
  if (price == null || price <= 0) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    destination: row.destination,
    departureDate: isoDate(row.departure_date),
    returnDate:
      row.return_date == null ? null : isoDate(row.return_date),
    capacity: Number(row.capacity),
    status: row.status,
    accommodationNote: row.accommodation_note,
    publicPackagePrice: Number(price),
    heroImageUrl: row.hero_image_url?.trim() || null,
    galleryUrls: parseGalleryUrls(row.gallery_urls),
  };
}

/**
 * Featured trip selection:
 * 1. `is_featured = true` AND `status = 'Open'`, soonest departure
 * 2. Else soonest upcoming `Open` trip (departure_date >= today)
 */
export async function getFeaturedTrip(
  sql: SqlExecutor,
  tenantId: string,
): Promise<FeaturedTrip | null> {
  await ensureTripReturnDateSchema(sql);
  const featuredRows = (await sql`
    SELECT
      id, tenant_id, name, destination, departure_date, return_date, capacity, status,
      accommodation_note, public_package_price, hero_image_url, gallery_urls, is_featured
    FROM trips
    WHERE tenant_id = ${tenantId}
      AND status = 'Open'
      AND is_featured = true
      AND public_package_price IS NOT NULL
      AND public_package_price > 0
    ORDER BY departure_date ASC
    LIMIT 1
  `) as TripRow[];

  const featured = featuredRows[0] ? mapTripRow(featuredRows[0]) : null;
  if (featured) return featured;

  const upcomingRows = (await sql`
    SELECT
      id, tenant_id, name, destination, departure_date, return_date, capacity, status,
      accommodation_note, public_package_price, hero_image_url, gallery_urls, is_featured
    FROM trips
    WHERE tenant_id = ${tenantId}
      AND status = 'Open'
      AND departure_date >= CURRENT_DATE
      AND public_package_price IS NOT NULL
      AND public_package_price > 0
    ORDER BY departure_date ASC
    LIMIT 1
  `) as TripRow[];

  return upcomingRows[0] ? mapTripRow(upcomingRows[0]) : null;
}

export type PublicCheckoutInput = {
  fullName: string;
  phone: string;
  email: string;
  idNumber: string | null;
  successUrl: string;
  cancelUrl: string;
};

export type PublicCheckoutResult =
  | { ok: true; redirectUrl: string; clientId: string; checkoutId: string }
  | { ok: false; error: string; status?: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createPublicCheckout(
  input: PublicCheckoutInput,
): Promise<PublicCheckoutResult> {
  const tenantId = getPublicTenantId();
  if (!tenantId) {
    return {
      ok: false,
      error: "PUBLIC_TENANT_ID is not configured.",
      status: 503,
    };
  }

  const sql = getSql();
  if (!sql) {
    return {
      ok: false,
      error: "Database not configured. Set DATABASE_URL.",
      status: 503,
    };
  }

  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();
  const idNumber = input.idNumber?.trim() || null;

  if (!fullName) return { ok: false, error: "Full name is required." };
  if (!phone) return { ok: false, error: "Phone number is required." };
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "A valid email address is required." };
  }

  const trip = await getFeaturedTrip(sql, tenantId);
  if (!trip) {
    return {
      ok: false,
      error: "No trip is available for public booking. Mark a trip as featured with a public price.",
      status: 404,
    };
  }

  const clientId = `c-${randomUUID()}`;
  const balanceDueDate = trip.departureDate;

  try {
    await sql`
      INSERT INTO clients
        (id, tenant_id, trip_id, full_name, phone, email, id_number, package_price, discount, balance_due_date, booking_status)
      VALUES
        (${clientId}, ${tenantId}, ${trip.id}, ${fullName}, ${phone}, ${email}, ${idNumber},
         ${trip.publicPackagePrice}, 0, ${balanceDueDate}, 'pending')
    `;
  } catch (e) {
    console.error("[public-booking] failed to create pending client:", e);
    return { ok: false, error: "Could not reserve your booking. Please try again." };
  }

  const metadata = {
    clientId,
    tripId: trip.id,
    tenantId,
    fullName,
    phone,
    email,
    idNumber: idNumber ?? "",
  };

  let checkout;
  try {
    checkout = await createYocoCheckout({
      amountCents: zarToCents(trip.publicPackagePrice),
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      metadata,
      idempotencyKey: `book-${clientId}`,
    });
  } catch (e) {
    console.error("[public-booking] Yoco checkout failed:", e);
    await sql`
      DELETE FROM clients
      WHERE id = ${clientId} AND tenant_id = ${tenantId} AND booking_status = 'pending'
    `;
    const message = e instanceof Error ? e.message : "Payment provider error.";
    return { ok: false, error: message };
  }

  try {
    await sql`
      UPDATE clients
      SET yoco_checkout_id = ${checkout.id}
      WHERE id = ${clientId} AND tenant_id = ${tenantId}
    `;
  } catch (e) {
    console.error("[public-booking] failed to link checkout id:", e);
  }

  return {
    ok: true,
    redirectUrl: checkout.redirectUrl,
    clientId,
    checkoutId: checkout.id,
  };
}

export type FulfillWebhookResult =
  | { ok: true; duplicate: boolean; clientId?: string }
  | { ok: false; error: string; alert: boolean };

/**
 * Process a verified `payment.succeeded` webhook idempotently.
 * Source of truth for marking a booking paid — not the browser redirect.
 */
export async function fulfillYocoPaymentSucceeded(
  event: YocoWebhookEvent,
): Promise<FulfillWebhookResult> {
  if (event.type !== "payment.succeeded") {
    return { ok: true, duplicate: false };
  }

  const sql = getSql();
  if (!sql) {
    console.error("[yoco-webhook] DATABASE_URL missing — payment succeeded but DB unavailable", {
      eventId: event.id,
    });
    return {
      ok: false,
      error: "Database not configured.",
      alert: true,
    };
  }

  const existingEvent = (await sql`
    SELECT id FROM yoco_webhook_events WHERE id = ${event.id} LIMIT 1
  `) as Array<{ id: string }>;

  if (existingEvent.length > 0) {
    return { ok: true, duplicate: true };
  }

  const payload = event.payload;
  const clientId = metadataString(payload, "clientId");
  const tripId = metadataString(payload, "tripId");
  const tenantId = metadataString(payload, "tenantId");

  const checkoutId =
    (typeof payload.checkoutId === "string" && payload.checkoutId) ||
    metadataString(payload, "checkoutId") ||
    null;

  const paymentId =
    typeof payload.id === "string" ? payload.id : null;

  const externalRef = checkoutId
    ? `yoco:checkout:${checkoutId}`
    : paymentId
      ? `yoco:payment:${paymentId}`
      : null;

  if (!externalRef) {
    console.error("[yoco-webhook] missing checkout/payment id in payload", {
      eventId: event.id,
      payload,
    });
    return { ok: false, error: "Missing payment reference in webhook.", alert: true };
  }

  const dupPayment = (await sql`
    SELECT id FROM payments WHERE external_ref = ${externalRef} LIMIT 1
  `) as Array<{ id: string }>;

  if (dupPayment.length > 0) {
    await sql`
      INSERT INTO yoco_webhook_events (id) VALUES (${event.id})
      ON CONFLICT (id) DO NOTHING
    `;
    return { ok: true, duplicate: true, clientId: clientId ?? undefined };
  }

  let resolvedClientId = clientId;
  let resolvedTripId = tripId;
  let resolvedTenantId = tenantId;

  if (!resolvedClientId && checkoutId) {
    const byCheckout = (await sql`
      SELECT id, trip_id, tenant_id
      FROM clients
      WHERE yoco_checkout_id = ${checkoutId}
      LIMIT 1
    `) as Array<{ id: string; trip_id: string; tenant_id: string }>;
    if (byCheckout[0]) {
      resolvedClientId = byCheckout[0].id;
      resolvedTripId = byCheckout[0].trip_id;
      resolvedTenantId = byCheckout[0].tenant_id;
    }
  }

  if (!resolvedClientId || !resolvedTripId || !resolvedTenantId) {
    console.error("[yoco-webhook] could not resolve client/trip/tenant", {
      eventId: event.id,
      clientId,
      tripId,
      tenantId,
      checkoutId,
    });
    return { ok: false, error: "Missing booking metadata.", alert: true };
  }

  const amountCents =
    typeof payload.amount === "number"
      ? payload.amount
      : Number(payload.amount);
  const amountZar =
    Number.isFinite(amountCents) && amountCents > 0
      ? centsToZar(amountCents)
      : null;

  if (!amountZar) {
    console.error("[yoco-webhook] invalid amount in payload", {
      eventId: event.id,
      amount: payload.amount,
    });
    return { ok: false, error: "Invalid payment amount.", alert: true };
  }

  const paymentRowId = `p-${randomUUID()}`;
  const invoiceNumber = await nextInvoiceNumber(sql, resolvedTenantId);
  const paidAt = new Date().toISOString();
  const note = checkoutId ? `Yoco checkout ${checkoutId}` : null;

  try {
    const tx = sql as unknown as {
      transaction: (queries: SqlExecutor[]) => Promise<unknown[]>;
    };
    await tx.transaction([
      sql`
        INSERT INTO yoco_webhook_events (id) VALUES (${event.id})
        ON CONFLICT (id) DO NOTHING
      `,
      sql`
        UPDATE clients
        SET booking_status = 'confirmed'
        WHERE id = ${resolvedClientId} AND tenant_id = ${resolvedTenantId}
      `,
      sql`
        INSERT INTO payments
          (id, tenant_id, invoice_number, client_id, trip_id, amount, paid_at, method, note, external_ref)
        VALUES
          (${paymentRowId}, ${resolvedTenantId}, ${invoiceNumber}, ${resolvedClientId},
           ${resolvedTripId}, ${amountZar}, ${paidAt}, 'Yoco', ${note}, ${externalRef})
      `,
    ] as unknown as SqlExecutor[]);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("unique") || message.includes("duplicate")) {
      await sql`
        INSERT INTO yoco_webhook_events (id) VALUES (${event.id})
        ON CONFLICT (id) DO NOTHING
      `;
      return { ok: true, duplicate: true, clientId: resolvedClientId };
    }

    console.error("[yoco-webhook] CRITICAL: payment succeeded but DB write failed", {
      eventId: event.id,
      externalRef,
      clientId: resolvedClientId,
      error: message,
    });
    return {
      ok: false,
      error: `Database write failed: ${message}`,
      alert: true,
    };
  }

  const clientRows = (await sql`
    SELECT full_name, email
    FROM clients
    WHERE id = ${resolvedClientId} AND tenant_id = ${resolvedTenantId}
    LIMIT 1
  `) as Array<{ full_name: string; email: string }>;

  const tripRows = (await sql`
    SELECT name, destination, departure_date
    FROM trips
    WHERE id = ${resolvedTripId} AND tenant_id = ${resolvedTenantId}
    LIMIT 1
  `) as Array<{ name: string; destination: string; departure_date: string | Date }>;

  const client = clientRows[0];
  const trip = tripRows[0];

  if (client?.email) {
    try {
      await sendBookingConfirmationEmail({
        to: client.email,
        clientName: client.full_name,
        tripName: trip?.name ?? "Your trip",
        destination: trip?.destination ?? "",
        departureDate: trip ? isoDate(trip.departure_date) : "",
        amountZar,
        invoiceNumber,
      });
    } catch (emailErr) {
      console.error("[yoco-webhook] confirmation email failed (booking saved):", emailErr);
    }
  }

  return { ok: true, duplicate: false, clientId: resolvedClientId };
}
