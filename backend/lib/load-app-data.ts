import { trips, clients, payments } from "./data";
import { sanitizeIsoYear } from "./date-year";
import { getSql } from "./db";
import { DEFAULT_INVOICE_TERMS, getInvoiceTerms } from "./invoice-terms";
import { tripTenantById } from "./tenant-scope";
import type { AppData } from "./app-data";
import type { Client, Payment, Trip, TripStatus } from "./types";

export type LoadAppDataResult = {
  data: AppData;
  /** Set when `DATABASE_URL` is configured but Neon could not be reached. */
  dbError?: string;
};

function memoryFallback(tenantId: string, invoiceTerms: string[]): AppData {
  const tenantTripIds = new Set(
    trips
      .filter((t) => tripTenantById.get(t.id) === tenantId)
      .map((t) => t.id),
  );
  const tenantClients = clients.filter((c) => tenantTripIds.has(c.tripId));
  const tenantClientIds = new Set(tenantClients.map((c) => c.id));
  return {
    trips: trips.filter((t) => tenantTripIds.has(t.id)),
    clients: tenantClients,
    payments: payments.filter(
      (p) => tenantTripIds.has(p.tripId) && tenantClientIds.has(p.clientId),
    ),
    invoiceTerms,
  };
}

/** Neon when `DATABASE_URL` is set; otherwise typed empty fallback from `data.ts`. */
export async function loadAppData(tenantId: string): Promise<LoadAppDataResult> {
  const sql = getSql();
  if (!sql) {
    const invoiceTerms = await getInvoiceTerms(undefined, tenantId);
    return { data: memoryFallback(tenantId, invoiceTerms) };
  }

  try {
    const [tripRows, clientRows, paymentRows, invoiceTerms] = await Promise.all([
      sql`
        SELECT id, name, destination, departure_date, capacity, status, accommodation_note
        FROM trips
        WHERE tenant_id = ${tenantId}
        ORDER BY departure_date ASC
      `,
      sql`
        SELECT id, trip_id, full_name, phone, email, id_number, package_price, balance_due_date
        FROM clients
        WHERE tenant_id = ${tenantId}
      `,
      sql`
        SELECT id, invoice_number, client_id, trip_id, amount, paid_at, method, note
        FROM payments
        WHERE tenant_id = ${tenantId}
        ORDER BY paid_at ASC
      `,
      getInvoiceTerms(sql, tenantId),
    ]);

    const mappedTrips: Trip[] = (tripRows as TripRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      destination: row.destination,
      departureDate: isoDateSlice(row.departure_date),
      capacity: Number(row.capacity),
      status: row.status as TripStatus,
      accommodationNote: row.accommodation_note,
    }));

    const mappedClients: Client[] = (clientRows as ClientRow[]).map((row) => ({
      id: row.id,
      tripId: row.trip_id,
      fullName: row.full_name,
      phone: row.phone,
      email: row.email,
      idNumber: row.id_number?.trim() || null,
      packagePrice: Number(row.package_price),
      balanceDueDate: isoDateSlice(row.balance_due_date),
    }));

    const mappedPayments: Payment[] = (paymentRows as PaymentRow[]).map(
      (row) => ({
        id: row.id,
        invoiceNumber: row.invoice_number,
        clientId: row.client_id,
        tripId: row.trip_id,
        amount: Number(row.amount),
        paidAt: isoDateTime(row.paid_at),
        method: row.method,
        note: row.note ?? undefined,
      }),
    );

    return {
      data: {
        trips: mappedTrips,
        clients: mappedClients,
        payments: mappedPayments,
        invoiceTerms,
      },
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[loadAppData] Neon query failed:", detail);
    return {
      data: memoryFallback(tenantId, [...DEFAULT_INVOICE_TERMS]),
      dbError:
        "Could not connect to Neon. Check DATABASE_URL in frontend/.env.local, wake the project in the Neon dashboard, and try removing channel_binding=require from the connection string. Visit /api/db-health for details.",
    };
  }
}

type TripRow = {
  id: string;
  name: string;
  destination: string;
  departure_date: string;
  capacity: number;
  status: string;
  accommodation_note: string;
};

type ClientRow = {
  id: string;
  trip_id: string;
  full_name: string;
  phone: string;
  email: string;
  id_number: string | null;
  package_price: number;
  balance_due_date: string;
};

type PaymentRow = {
  id: string;
  invoice_number: string;
  client_id: string;
  trip_id: string;
  amount: number;
  paid_at: string | Date;
  method: string;
  note: string | null;
};

function isoDateSlice(value: string | Date): string {
  const s = typeof value === "string" ? value : value.toISOString();
  return sanitizeIsoYear(s.length >= 10 ? s.slice(0, 10) : s);
}

function isoDateTime(value: string | Date): string {
  const s =
    typeof value === "string"
      ? value
      : value.toISOString().replace(/\.\d{3}Z$/, "Z");
  return sanitizeIsoYear(s);
}
