import { trips, clients, payments } from "./data";
import { getSql } from "./db";
import type { AppData } from "./app-data";
import type { Client, Payment, Trip, TripStatus } from "./types";

/** Use Neon when `DATABASE_URL` is set; otherwise the bundled demo arrays in `data.ts`. */
export async function loadAppData(): Promise<AppData> {
  const sql = getSql();
  if (!sql) {
    return { trips: [...trips], clients: [...clients], payments: [...payments] };
  }

  const [tripRows, clientRows, paymentRows] = await Promise.all([
    sql`
      SELECT id, name, destination, departure_date, capacity, status, accommodation_note
      FROM trips
      ORDER BY departure_date ASC
    `,
    sql`
      SELECT id, trip_id, full_name, phone, email, package_price, balance_due_date
      FROM clients
    `,
    sql`
      SELECT id, invoice_number, client_id, trip_id, amount, paid_at, method, note
      FROM payments
      ORDER BY paid_at ASC
    `,
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
    trips: mappedTrips,
    clients: mappedClients,
    payments: mappedPayments,
  };
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
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function isoDateTime(value: string | Date): string {
  if (typeof value === "string") return value;
  return value.toISOString().replace(/\.\d{3}Z$/, "Z");
}
