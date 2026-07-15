import { randomBytes } from "node:crypto";

import {
  ensureGroupBookingDocumentsSchema,
  insertGroupBookingDocument,
  insertGroupBookingPassengerPaymentDocument,
} from "./documents";
import type {
  GroupBookingListItem,
  GroupBookingPassenger,
  GroupBookingPassengerPayment,
  GroupBookingStatus,
  GroupBookingWithPassengers,
  TenantGroupSplitPassenger,
  TripGroupSplitPassenger,
} from "./types";

type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

type SqlClient = SqlExecutor & {
  transaction: (queries: SqlExecutor[]) => Promise<unknown[]>;
};

function id(prefix: string): string {
  return `${prefix}-${randomBytes(9).toString("hex")}`;
}

function isoTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function isoDateSlice(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/** Neon DATE values arrive as local-midnight Dates — avoid UTC day shift. */
function calendarDateSlice(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = value.getMonth() + 1;
    const d = value.getDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return String(value).slice(0, 10);
}

function parseGroupStatus(raw: string): GroupBookingStatus {
  if (raw === "Partial" || raw === "Complete") return raw;
  return "Pending";
}

export function passengerBalance(passenger: {
  packagePrice: number;
  amountPaid: number;
}): number {
  return Math.max(0, passenger.packagePrice - passenger.amountPaid);
}

export function computeGroupBookingStatus(
  passengers: { packagePrice: number; amountPaid: number }[],
): GroupBookingStatus {
  if (passengers.length === 0) return "Pending";
  if (passengers.every((p) => passengerBalance(p) <= 0)) return "Complete";
  if (passengers.some((p) => p.amountPaid > 0)) return "Partial";
  return "Pending";
}

export async function ensureGroupBookingBalancesSchema(
  sql: SqlExecutor,
): Promise<void> {
  await ensureGroupBookingDocumentsSchema(sql);
  await sql`
    ALTER TABLE group_booking_passengers
    ADD COLUMN IF NOT EXISTS package_price INTEGER
  `;
  await sql`
    ALTER TABLE group_booking_passengers
    ADD COLUMN IF NOT EXISTS amount_paid INTEGER NOT NULL DEFAULT 0
  `;
  await sql`
    ALTER TABLE group_booking_passengers
    ADD COLUMN IF NOT EXISTS passenger_phone TEXT NOT NULL DEFAULT ''
  `;
  await sql`
    ALTER TABLE group_booking_passengers
    ADD COLUMN IF NOT EXISTS passenger_id_number TEXT
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS group_booking_passenger_payments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
      passenger_id TEXT NOT NULL REFERENCES group_booking_passengers (id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      paid_at DATE NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_gb_passenger_payments_passenger
      ON group_booking_passenger_payments (passenger_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_gb_passenger_payments_tenant
      ON group_booking_passenger_payments (tenant_id)
  `;
  await sql`
    ALTER TABLE group_booking_documents
    ADD COLUMN IF NOT EXISTS passenger_payment_id TEXT
    REFERENCES group_booking_passenger_payments (id) ON DELETE CASCADE
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_group_booking_documents_payment
      ON group_booking_documents (passenger_payment_id)
  `;

  // Initial group share (`amount`) is always credited as paid. Follow-up
  // payments in group_booking_passenger_payments add on top.
  await sql`
    UPDATE group_booking_passengers gbp
    SET
      package_price = COALESCE(gbp.package_price, gbp.amount),
      amount_paid = gbp.amount + COALESCE((
        SELECT SUM(p.amount)::int
        FROM group_booking_passenger_payments p
        WHERE p.passenger_id = gbp.id
      ), 0)
    WHERE gbp.package_price IS NULL
      OR COALESCE(gbp.amount_paid, 0) <> gbp.amount + COALESCE((
        SELECT SUM(p.amount)::int
        FROM group_booking_passenger_payments p
        WHERE p.passenger_id = gbp.id
      ), 0)
  `;

  await sql`
    UPDATE group_bookings gb
    SET status = CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM group_booking_passengers gbp
        WHERE gbp.group_booking_id = gb.id
      ) THEN 'Pending'
      WHEN NOT EXISTS (
        SELECT 1 FROM group_booking_passengers gbp
        WHERE gbp.group_booking_id = gb.id
          AND COALESCE(gbp.package_price, gbp.amount)
            > COALESCE(gbp.amount_paid, 0)
      ) THEN 'Complete'
      WHEN EXISTS (
        SELECT 1 FROM group_booking_passengers gbp
        WHERE gbp.group_booking_id = gb.id
          AND COALESCE(gbp.amount_paid, 0) > 0
      ) THEN 'Partial'
      ELSE 'Pending'
    END
    WHERE status IS DISTINCT FROM (
      CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM group_booking_passengers gbp
          WHERE gbp.group_booking_id = gb.id
        ) THEN 'Pending'
        WHEN NOT EXISTS (
          SELECT 1 FROM group_booking_passengers gbp
          WHERE gbp.group_booking_id = gb.id
            AND COALESCE(gbp.package_price, gbp.amount)
              > COALESCE(gbp.amount_paid, 0)
        ) THEN 'Complete'
        WHEN EXISTS (
          SELECT 1 FROM group_booking_passengers gbp
          WHERE gbp.group_booking_id = gb.id
            AND COALESCE(gbp.amount_paid, 0) > 0
        ) THEN 'Partial'
        ELSE 'Pending'
      END
    )
  `;
}

export async function nextGroupBookingReference(
  sql: SqlExecutor,
  tenantId: string,
): Promise<string> {
  const rows = (await sql`
    SELECT reference_number
    FROM group_bookings
    WHERE tenant_id = ${tenantId}
      AND reference_number LIKE 'GBK-%'
  `) as { reference_number: string }[];

  let max = 0;
  for (const row of rows) {
    const m = /^GBK-(\d+)$/i.exec(row.reference_number.trim());
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }

  return `GBK-${String(max + 1).padStart(4, "0")}`;
}

export type CreateGroupBookingPassengerInput = {
  passengerName: string;
  passengerEmail: string;
  amount: number;
};

export type CreateGroupBookingInput = {
  tripId: string;
  totalAmount: number;
  packagePricePerPerson: number;
  paidAt: string;
  passengers: CreateGroupBookingPassengerInput[];
  proofFileName: string;
  proofBuffer: Buffer;
};

export type CreateGroupBookingResult =
  | { ok: true; groupBooking: GroupBookingWithPassengers }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCreateGroupBookingFormData(
  form: FormData,
): { ok: true; input: CreateGroupBookingInput } | { ok: false; error: string } {
  const tripId =
    typeof form.get("tripId") === "string"
      ? String(form.get("tripId")).trim()
      : "";
  const totalAmountRaw = form.get("totalAmount");
  const totalAmount =
    typeof totalAmountRaw === "string"
      ? Number(totalAmountRaw)
      : Number(totalAmountRaw);
  const packagePriceRaw = form.get("packagePricePerPerson");
  const packagePricePerPerson =
    typeof packagePriceRaw === "string"
      ? Number(packagePriceRaw)
      : Number(packagePriceRaw);
  const paidAt =
    typeof form.get("paidAt") === "string"
      ? String(form.get("paidAt")).trim()
      : "";
  const passengersRaw = form.get("passengers");

  if (!tripId) return { ok: false, error: "Trip is required." };
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { ok: false, error: "Total amount must be a positive number." };
  }
  if (!Number.isFinite(packagePricePerPerson) || packagePricePerPerson <= 0) {
    return {
      ok: false,
      error: "Package price per person must be a positive number.",
    };
  }
  if (!paidAt || !DATE_RE.test(paidAt)) {
    return { ok: false, error: "Payment date must be YYYY-MM-DD." };
  }

  const file = form.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return { ok: false, error: "Proof of payment PDF is required." };
  }
  const typedFile = file as File;

  let rawPassengers: unknown[] = [];
  try {
    rawPassengers = JSON.parse(
      typeof passengersRaw === "string" ? passengersRaw : "[]",
    ) as unknown[];
  } catch {
    return { ok: false, error: "Invalid passengers JSON." };
  }

  if (!Array.isArray(rawPassengers) || rawPassengers.length === 0) {
    return { ok: false, error: "Add at least one passenger." };
  }

  const passengers: CreateGroupBookingPassengerInput[] = [];
  for (let i = 0; i < rawPassengers.length; i++) {
    const row = rawPassengers[i];
    if (!row || typeof row !== "object") {
      return { ok: false, error: `Passenger ${i + 1} is invalid.` };
    }
    const p = row as Record<string, unknown>;
    const passengerName =
      typeof p.passengerName === "string" ? p.passengerName.trim() : "";
    const passengerEmail =
      typeof p.passengerEmail === "string" ? p.passengerEmail.trim() : "";
    const amountRaw = p.amount;
    const amount =
      typeof amountRaw === "number"
        ? amountRaw
        : typeof amountRaw === "string"
          ? Number(amountRaw)
          : NaN;

    if (!passengerName) {
      return { ok: false, error: `Passenger ${i + 1} needs a name.` };
    }
    if (passengerEmail && !EMAIL_RE.test(passengerEmail)) {
      return { ok: false, error: `Passenger ${i + 1} needs a valid email.` };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false,
        error: `Passenger ${i + 1} amount must be positive.`,
      };
    }
    if (amount > Math.round(packagePricePerPerson)) {
      return {
        ok: false,
        error: `Passenger ${i + 1} allocation cannot exceed the package price.`,
      };
    }

    passengers.push({
      passengerName,
      passengerEmail,
      amount: Math.round(amount),
    });
  }

  const sum = passengers.reduce((s, p) => s + p.amount, 0);
  const roundedTotal = Math.round(totalAmount);
  if (sum !== roundedTotal) {
    return {
      ok: false,
      error: `Passenger amounts (${sum}) must equal total (${roundedTotal}).`,
    };
  }

  return {
    ok: true,
    input: {
      tripId,
      totalAmount: roundedTotal,
      packagePricePerPerson: Math.round(packagePricePerPerson),
      paidAt,
      passengers,
      proofFileName: typedFile.name || "proof.pdf",
      proofBuffer: Buffer.alloc(0),
    },
  };
}

function mapPassengerRow(row: {
  id: string;
  group_booking_id: string;
  passenger_name: string;
  passenger_email: string;
  amount: number | string;
  package_price: number | string | null;
  amount_paid: number | string | null;
  created_at: unknown;
}): GroupBookingPassenger {
  const allocatedAmount = Number(row.amount);
  const packagePrice = Number(row.package_price ?? row.amount);
  const amountPaid = Number(row.amount_paid ?? 0);
  return {
    id: row.id,
    groupBookingId: row.group_booking_id,
    passengerName: row.passenger_name,
    passengerEmail: row.passenger_email,
    allocatedAmount,
    packagePrice,
    amountPaid,
    createdAt: isoTimestamp(row.created_at),
  };
}

export async function createGroupBooking(
  sql: SqlClient,
  tenantId: string,
  input: CreateGroupBookingInput,
): Promise<CreateGroupBookingResult> {
  await ensureGroupBookingBalancesSchema(sql);

  const tripRows = (await sql`
    SELECT id, name, destination
    FROM trips
    WHERE id = ${input.tripId} AND tenant_id = ${tenantId}
    LIMIT 1
  `) as { id: string; name: string; destination: string }[];

  const trip = tripRows[0];
  if (!trip) return { ok: false, error: "Trip not found." };

  const groupBookingId = id("gb");
  const referenceNumber = await nextGroupBookingReference(sql, tenantId);

  const passengerRecords = input.passengers.map((p) => ({
    id: id("gbp"),
    passengerName: p.passengerName,
    passengerEmail: p.passengerEmail,
    amount: p.amount,
    packagePrice: input.packagePricePerPerson,
    amountPaid: p.amount,
  }));

  const status = computeGroupBookingStatus(passengerRecords);

  const txQueries = [
    sql`
      INSERT INTO group_bookings
        (id, tenant_id, reference_number, trip_id, total_amount, paid_at, status)
      VALUES
        (
          ${groupBookingId},
          ${tenantId},
          ${referenceNumber},
          ${input.tripId},
          ${input.totalAmount},
          ${input.paidAt},
          ${status}
        )
    `,
    ...passengerRecords.map((p) =>
      sql`
        INSERT INTO group_booking_passengers
          (
            id,
            group_booking_id,
            passenger_name,
            passenger_email,
            amount,
            package_price,
            amount_paid,
            paid_status
          )
        VALUES
          (
            ${p.id},
            ${groupBookingId},
            ${p.passengerName},
            ${p.passengerEmail},
            ${p.amount},
            ${p.packagePrice},
            ${p.amountPaid},
            ${"unpaid"}
          )
      `,
    ),
  ];

  await sql.transaction(txQueries as unknown as SqlExecutor[]);

  await insertGroupBookingDocument(
    sql,
    tenantId,
    groupBookingId,
    "Group payment proof",
    input.proofFileName,
    input.proofBuffer,
  );

  const createdAt = new Date().toISOString();
  const passengers: GroupBookingPassenger[] = passengerRecords.map((p) => ({
    id: p.id,
    groupBookingId,
    passengerName: p.passengerName,
    passengerEmail: p.passengerEmail,
    allocatedAmount: p.amount,
    packagePrice: p.packagePrice,
    amountPaid: p.amountPaid,
    createdAt,
  }));

  return {
    ok: true,
    groupBooking: {
      id: groupBookingId,
      referenceNumber,
      tripId: input.tripId,
      totalAmount: input.totalAmount,
      paidAt: input.paidAt,
      status,
      createdAt,
      proofFileName: input.proofFileName,
      tripName: trip.name,
      tripDestination: trip.destination,
      passengers,
    },
  };
}

export async function listGroupBookings(
  sql: SqlExecutor,
  tenantId: string,
): Promise<GroupBookingListItem[]> {
  await ensureGroupBookingBalancesSchema(sql);

  const rows = (await sql`
    SELECT
      gb.id,
      gb.reference_number,
      gb.trip_id,
      gb.total_amount,
      gb.paid_at,
      gb.status,
      gb.created_at,
      t.name AS trip_name,
      COUNT(gbp.id)::int AS passenger_count,
      COALESCE(SUM(COALESCE(gbp.package_price, gbp.amount)), 0)::int AS total_expected,
      COALESCE(SUM(COALESCE(gbp.amount_paid, 0)), 0)::int AS total_paid
    FROM group_bookings gb
    JOIN trips t ON t.id = gb.trip_id
    LEFT JOIN group_booking_passengers gbp ON gbp.group_booking_id = gb.id
    WHERE gb.tenant_id = ${tenantId}
    GROUP BY gb.id, t.name, gb.paid_at
    ORDER BY gb.created_at DESC
  `) as {
    id: string;
    reference_number: string;
    trip_id: string;
    total_amount: number | string;
    paid_at: string | Date;
    status: string;
    created_at: unknown;
    trip_name: string;
    passenger_count: number | string;
    total_expected: number | string;
    total_paid: number | string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    referenceNumber: row.reference_number,
    tripId: row.trip_id,
    totalAmount: Number(row.total_amount),
    paidAt: isoDateSlice(row.paid_at),
    status: parseGroupStatus(row.status),
    createdAt: isoTimestamp(row.created_at),
    tripName: row.trip_name,
    passengerCount: Number(row.passenger_count),
    totalExpected: Number(row.total_expected),
    totalPaid: Number(row.total_paid),
  }));
}

export type TripGroupSplitSummary = {
  passengerCount: number;
  totalExpected: number;
  totalPaid: number;
  outstanding: number;
};

export async function summarizeGroupSplitByTrip(
  sql: SqlExecutor,
  tenantId: string,
): Promise<Record<string, TripGroupSplitSummary>> {
  await ensureGroupBookingBalancesSchema(sql);

  const rows = (await sql`
    SELECT
      gb.trip_id,
      COUNT(gbp.id)::int AS passenger_count,
      COALESCE(SUM(COALESCE(gbp.package_price, gbp.amount)), 0)::int AS total_expected,
      COALESCE(SUM(COALESCE(gbp.amount_paid, 0)), 0)::int AS total_paid
    FROM group_booking_passengers gbp
    JOIN group_bookings gb ON gb.id = gbp.group_booking_id
    WHERE gb.tenant_id = ${tenantId}
    GROUP BY gb.trip_id
  `) as {
    trip_id: string;
    passenger_count: number | string;
    total_expected: number | string;
    total_paid: number | string;
  }[];

  const out: Record<string, TripGroupSplitSummary> = {};
  for (const row of rows) {
    const totalExpected = Number(row.total_expected);
    const totalPaid = Number(row.total_paid);
    out[row.trip_id] = {
      passengerCount: Number(row.passenger_count),
      totalExpected,
      totalPaid,
      outstanding: Math.max(0, totalExpected - totalPaid),
    };
  }
  return out;
}

export async function listTripGroupSplitPassengers(
  sql: SqlExecutor,
  tenantId: string,
  tripId: string,
): Promise<TripGroupSplitPassenger[]> {
  await ensureGroupBookingBalancesSchema(sql);

  const rows = (await sql`
    SELECT
      gbp.id,
      gbp.group_booking_id,
      gb.reference_number,
      gbp.passenger_name,
      gbp.passenger_email,
      COALESCE(gbp.passenger_phone, '') AS passenger_phone,
      gbp.passenger_id_number,
      gbp.package_price,
      gbp.amount,
      gbp.amount_paid,
      gbp.created_at
    FROM group_booking_passengers gbp
    JOIN group_bookings gb ON gb.id = gbp.group_booking_id
    WHERE gb.trip_id = ${tripId}
      AND gb.tenant_id = ${tenantId}
    ORDER BY gbp.created_at ASC
  `) as {
    id: string;
    group_booking_id: string;
    reference_number: string;
    passenger_name: string;
    passenger_email: string;
    passenger_phone: string;
    passenger_id_number: string | null;
    package_price: number | string | null;
    amount: number | string;
    amount_paid: number | string | null;
    created_at: unknown;
  }[];

  return rows.map((row) => ({
    id: row.id,
    groupBookingId: row.group_booking_id,
    referenceNumber: row.reference_number,
    passengerName: row.passenger_name,
    passengerEmail: row.passenger_email,
    passengerPhone: row.passenger_phone ?? "",
    passengerIdNumber: row.passenger_id_number?.trim()
      ? row.passenger_id_number.trim()
      : null,
    packagePrice: Number(row.package_price ?? row.amount),
    amountPaid: Number(row.amount_paid ?? 0),
  }));
}

/** All group-split passengers for a tenant (Clients directory). */
export async function listTenantGroupSplitPassengers(
  sql: SqlExecutor,
  tenantId: string,
): Promise<TenantGroupSplitPassenger[]> {
  await ensureGroupBookingBalancesSchema(sql);

  const rows = (await sql`
    SELECT
      gbp.id,
      gbp.group_booking_id,
      gb.reference_number,
      gb.trip_id,
      t.name AS trip_name,
      t.destination AS trip_destination,
      t.departure_date,
      gbp.passenger_name,
      gbp.passenger_email,
      COALESCE(gbp.passenger_phone, '') AS passenger_phone,
      gbp.passenger_id_number,
      gbp.package_price,
      gbp.amount,
      gbp.amount_paid,
      gbp.created_at
    FROM group_booking_passengers gbp
    JOIN group_bookings gb ON gb.id = gbp.group_booking_id
    JOIN trips t ON t.id = gb.trip_id
    WHERE gb.tenant_id = ${tenantId}
    ORDER BY t.destination ASC, gbp.passenger_name ASC
  `) as {
    id: string;
    group_booking_id: string;
    reference_number: string;
    trip_id: string;
    trip_name: string;
    trip_destination: string;
    departure_date: unknown;
    passenger_name: string;
    passenger_email: string;
    passenger_phone: string;
    passenger_id_number: string | null;
    package_price: number | string | null;
    amount: number | string;
    amount_paid: number | string | null;
    created_at: unknown;
  }[];

  return rows.map((row) => ({
    id: row.id,
    groupBookingId: row.group_booking_id,
    referenceNumber: row.reference_number,
    tripId: row.trip_id,
    tripName: row.trip_name,
    tripDestination: row.trip_destination,
    departureDate: calendarDateSlice(row.departure_date),
    passengerName: row.passenger_name,
    passengerEmail: row.passenger_email,
    passengerPhone: row.passenger_phone ?? "",
    passengerIdNumber: row.passenger_id_number?.trim()
      ? row.passenger_id_number.trim()
      : null,
    packagePrice: Number(row.package_price ?? row.amount),
    amountPaid: Number(row.amount_paid ?? 0),
  }));
}

export async function getTenantGroupSplitPassengerById(
  sql: SqlExecutor,
  tenantId: string,
  passengerId: string,
): Promise<
  (TenantGroupSplitPassenger & { allocatedAmount: number; paidAt: string }) | null
> {
  await ensureGroupBookingBalancesSchema(sql);

  const rows = (await sql`
    SELECT
      gbp.id,
      gbp.group_booking_id,
      gb.reference_number,
      gb.paid_at,
      gb.trip_id,
      t.name AS trip_name,
      t.destination AS trip_destination,
      t.departure_date,
      gbp.passenger_name,
      gbp.passenger_email,
      COALESCE(gbp.passenger_phone, '') AS passenger_phone,
      gbp.passenger_id_number,
      gbp.package_price,
      gbp.amount,
      gbp.amount_paid,
      gbp.created_at
    FROM group_booking_passengers gbp
    JOIN group_bookings gb ON gb.id = gbp.group_booking_id
    JOIN trips t ON t.id = gb.trip_id
    WHERE gb.tenant_id = ${tenantId}
      AND gbp.id = ${passengerId}
    LIMIT 1
  `) as {
    id: string;
    group_booking_id: string;
    reference_number: string;
    paid_at: string | Date;
    trip_id: string;
    trip_name: string;
    trip_destination: string;
    departure_date: unknown;
    passenger_name: string;
    passenger_email: string;
    passenger_phone: string;
    passenger_id_number: string | null;
    package_price: number | string | null;
    amount: number | string;
    amount_paid: number | string | null;
    created_at: unknown;
  }[];

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    groupBookingId: row.group_booking_id,
    referenceNumber: row.reference_number,
    tripId: row.trip_id,
    tripName: row.trip_name,
    tripDestination: row.trip_destination,
    departureDate: calendarDateSlice(row.departure_date),
    passengerName: row.passenger_name,
    passengerEmail: row.passenger_email,
    passengerPhone: row.passenger_phone ?? "",
    passengerIdNumber: row.passenger_id_number?.trim()
      ? row.passenger_id_number.trim()
      : null,
    packagePrice: Number(row.package_price ?? row.amount),
    amountPaid: Number(row.amount_paid ?? 0),
    allocatedAmount: Number(row.amount),
    paidAt: isoDateSlice(row.paid_at),
  };
}

export type UpdateGroupSplitPassengerContactInput = {
  passengerEmail?: string;
  passengerPhone?: string;
  passengerIdNumber?: string | null;
};

export async function updateGroupSplitPassengerContact(
  sql: SqlExecutor,
  tenantId: string,
  passengerId: string,
  input: UpdateGroupSplitPassengerContactInput,
): Promise<
  | { ok: true; passenger: TenantGroupSplitPassenger & { allocatedAmount: number; paidAt: string } }
  | { ok: false; error: string }
> {
  await ensureGroupBookingBalancesSchema(sql);

  const existing = await getTenantGroupSplitPassengerById(
    sql,
    tenantId,
    passengerId,
  );
  if (!existing) return { ok: false, error: "Passenger not found." };

  const email =
    input.passengerEmail !== undefined
      ? input.passengerEmail.trim()
      : existing.passengerEmail;
  const phone =
    input.passengerPhone !== undefined
      ? input.passengerPhone.trim()
      : existing.passengerPhone;
  const idNumberRaw =
    input.passengerIdNumber !== undefined
      ? input.passengerIdNumber
      : existing.passengerIdNumber;
  const idNumber =
    idNumberRaw == null || !String(idNumberRaw).trim()
      ? null
      : String(idNumberRaw).trim();

  if (email && !EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  await sql`
    UPDATE group_booking_passengers
    SET
      passenger_email = ${email},
      passenger_phone = ${phone},
      passenger_id_number = ${idNumber}
    WHERE id = ${passengerId}
      AND group_booking_id IN (
        SELECT id FROM group_bookings WHERE tenant_id = ${tenantId}
      )
  `;

  const updated = await getTenantGroupSplitPassengerById(
    sql,
    tenantId,
    passengerId,
  );
  if (!updated) return { ok: false, error: "Passenger not found after update." };
  return { ok: true, passenger: updated };
}

export async function deleteGroupSplitPassenger(
  sql: SqlExecutor,
  tenantId: string,
  passengerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureGroupBookingBalancesSchema(sql);

  const existing = await getTenantGroupSplitPassengerById(
    sql,
    tenantId,
    passengerId,
  );
  if (!existing) return { ok: false, error: "Passenger not found." };

  const groupBookingId = existing.groupBookingId;

  await sql`
    DELETE FROM group_booking_passengers gbp
    USING group_bookings gb
    WHERE gbp.id = ${passengerId}
      AND gbp.group_booking_id = gb.id
      AND gb.tenant_id = ${tenantId}
  `;

  const remaining = (await sql`
    SELECT
      COALESCE(package_price, amount) AS package_price,
      COALESCE(amount_paid, 0) AS amount_paid
    FROM group_booking_passengers
    WHERE group_booking_id = ${groupBookingId}
  `) as { package_price: number | string; amount_paid: number | string }[];

  const groupStatus = computeGroupBookingStatus(
    remaining.map((r) => ({
      packagePrice: Number(r.package_price),
      amountPaid: Number(r.amount_paid),
    })),
  );

  await sql`
    UPDATE group_bookings
    SET
      status = ${groupStatus},
      total_amount = ${remaining.reduce(
        (sum, r) => sum + Number(r.package_price),
        0,
      )}
    WHERE id = ${groupBookingId}
      AND tenant_id = ${tenantId}
  `;

  return { ok: true };
}

export async function deleteGroupSplitPassengerPayment(
  sql: SqlExecutor,
  tenantId: string,
  groupBookingId: string,
  passengerId: string,
  paymentId: string,
): Promise<
  | { ok: true; groupStatus: GroupBookingStatus }
  | { ok: false; error: string }
> {
  await ensureGroupBookingBalancesSchema(sql);

  const paymentRows = (await sql`
    SELECT p.id
    FROM group_booking_passenger_payments p
    JOIN group_booking_passengers gbp ON gbp.id = p.passenger_id
    JOIN group_bookings gb ON gb.id = gbp.group_booking_id
    WHERE p.id = ${paymentId}
      AND p.passenger_id = ${passengerId}
      AND gbp.group_booking_id = ${groupBookingId}
      AND p.tenant_id = ${tenantId}
      AND gb.tenant_id = ${tenantId}
    LIMIT 1
  `) as { id: string }[];

  if (!paymentRows[0]) {
    return { ok: false, error: "Payment not found." };
  }

  await sql`
    DELETE FROM group_booking_passenger_payments
    WHERE id = ${paymentId}
      AND tenant_id = ${tenantId}
  `;

  await sql`
    UPDATE group_booking_passengers gbp
    SET amount_paid = gbp.amount + COALESCE((
      SELECT SUM(p.amount)::int
      FROM group_booking_passenger_payments p
      WHERE p.passenger_id = gbp.id
    ), 0)
    WHERE gbp.id = ${passengerId}
      AND gbp.group_booking_id = ${groupBookingId}
  `;

  const remaining = (await sql`
    SELECT
      COALESCE(package_price, amount) AS package_price,
      COALESCE(amount_paid, 0) AS amount_paid
    FROM group_booking_passengers
    WHERE group_booking_id = ${groupBookingId}
  `) as { package_price: number | string; amount_paid: number | string }[];

  const groupStatus = computeGroupBookingStatus(
    remaining.map((r) => ({
      packagePrice: Number(r.package_price),
      amountPaid: Number(r.amount_paid),
    })),
  );

  await sql`
    UPDATE group_bookings
    SET status = ${groupStatus}
    WHERE id = ${groupBookingId}
      AND tenant_id = ${tenantId}
  `;

  return { ok: true, groupStatus };
}

export async function getGroupBookingById(
  sql: SqlExecutor,
  tenantId: string,
  groupBookingId: string,
): Promise<GroupBookingWithPassengers | null> {
  await ensureGroupBookingBalancesSchema(sql);

  const bookingRows = (await sql`
    SELECT
      gb.id,
      gb.reference_number,
      gb.trip_id,
      gb.total_amount,
      gb.paid_at,
      gb.status,
      gb.created_at,
      t.name AS trip_name,
      t.destination AS trip_destination,
      (
        SELECT file_name
        FROM group_booking_documents
        WHERE group_booking_id = gb.id
          AND tenant_id = gb.tenant_id
          AND passenger_payment_id IS NULL
        ORDER BY uploaded_at DESC
        LIMIT 1
      ) AS proof_file_name
    FROM group_bookings gb
    JOIN trips t ON t.id = gb.trip_id
    WHERE gb.id = ${groupBookingId} AND gb.tenant_id = ${tenantId}
    LIMIT 1
  `) as {
    id: string;
    reference_number: string;
    trip_id: string;
    total_amount: number | string;
    paid_at: string | Date;
    status: string;
    created_at: unknown;
    trip_name: string;
    trip_destination: string;
    proof_file_name: string | null;
  }[];

  const booking = bookingRows[0];
  if (!booking) return null;

  const passengerRows = (await sql`
    SELECT
      id,
      group_booking_id,
      passenger_name,
      passenger_email,
      amount,
      package_price,
      amount_paid,
      created_at
    FROM group_booking_passengers
    WHERE group_booking_id = ${groupBookingId}
    ORDER BY created_at ASC
  `) as {
    id: string;
    group_booking_id: string;
    passenger_name: string;
    passenger_email: string;
    amount: number | string;
    package_price: number | string | null;
    amount_paid: number | string | null;
    created_at: unknown;
  }[];

  const passengers = passengerRows.map(mapPassengerRow);

  return {
    id: booking.id,
    referenceNumber: booking.reference_number,
    tripId: booking.trip_id,
    totalAmount: Number(booking.total_amount),
    paidAt: isoDateSlice(booking.paid_at),
    status: parseGroupStatus(booking.status),
    createdAt: isoTimestamp(booking.created_at),
    proofFileName: booking.proof_file_name ?? undefined,
    tripName: booking.trip_name,
    tripDestination: booking.trip_destination,
    passengers,
  };
}

export async function listPassengerPayments(
  sql: SqlExecutor,
  tenantId: string,
  groupBookingId: string,
  passengerId: string,
): Promise<GroupBookingPassengerPayment[]> {
  await ensureGroupBookingBalancesSchema(sql);

  const passengerRows = (await sql`
    SELECT gbp.id
    FROM group_booking_passengers gbp
    JOIN group_bookings gb ON gb.id = gbp.group_booking_id
    WHERE gbp.id = ${passengerId}
      AND gbp.group_booking_id = ${groupBookingId}
      AND gb.tenant_id = ${tenantId}
    LIMIT 1
  `) as { id: string }[];
  if (!passengerRows[0]) return [];

  const rows = (await sql`
    SELECT
      p.id,
      p.passenger_id,
      p.amount,
      p.paid_at,
      p.note,
      p.created_at,
      (
        SELECT file_name
        FROM group_booking_documents
        WHERE passenger_payment_id = p.id
          AND tenant_id = ${tenantId}
        ORDER BY uploaded_at DESC
        LIMIT 1
      ) AS proof_file_name
    FROM group_booking_passenger_payments p
    WHERE p.passenger_id = ${passengerId}
      AND p.tenant_id = ${tenantId}
    ORDER BY p.paid_at ASC, p.created_at ASC
  `) as {
    id: string;
    passenger_id: string;
    amount: number | string;
    paid_at: string | Date;
    note: string | null;
    created_at: unknown;
    proof_file_name: string | null;
  }[];

  return rows.map((row) => ({
    id: row.id,
    passengerId: row.passenger_id,
    amount: Number(row.amount),
    paidAt: isoDateSlice(row.paid_at),
    note: row.note ?? undefined,
    createdAt: isoTimestamp(row.created_at),
    proofFileName: row.proof_file_name ?? undefined,
  }));
}

export type RecordPassengerPaymentInput = {
  amount: number;
  paidAt: string;
  note?: string;
  proofFileName?: string;
  proofBuffer?: Buffer;
};

export type RecordPassengerPaymentResult =
  | {
      ok: true;
      passenger: GroupBookingPassenger;
      payment: GroupBookingPassengerPayment;
      groupStatus: GroupBookingStatus;
    }
  | { ok: false; error: string };

export async function recordPassengerPayment(
  sql: SqlExecutor,
  tenantId: string,
  groupBookingId: string,
  passengerId: string,
  input: RecordPassengerPaymentInput,
): Promise<RecordPassengerPaymentResult> {
  await ensureGroupBookingBalancesSchema(sql);

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Payment amount must be positive." };
  }
  if (!DATE_RE.test(input.paidAt)) {
    return { ok: false, error: "Payment date must be YYYY-MM-DD." };
  }

  const passengerRows = (await sql`
    SELECT
      gbp.id,
      gbp.group_booking_id,
      gbp.passenger_name,
      gbp.passenger_email,
      gbp.amount,
      gbp.package_price,
      gbp.amount_paid,
      gbp.created_at
    FROM group_booking_passengers gbp
    JOIN group_bookings gb ON gb.id = gbp.group_booking_id
    WHERE gbp.id = ${passengerId}
      AND gbp.group_booking_id = ${groupBookingId}
      AND gb.tenant_id = ${tenantId}
    LIMIT 1
  `) as {
    id: string;
    group_booking_id: string;
    passenger_name: string;
    passenger_email: string;
    amount: number | string;
    package_price: number | string | null;
    amount_paid: number | string | null;
    created_at: unknown;
  }[];

  const row = passengerRows[0];
  if (!row) {
    return { ok: false, error: "Passenger not found." };
  }

  const passenger = mapPassengerRow(row);
  const balance = passengerBalance(passenger);
  const paymentAmount = Math.round(input.amount);

  if (paymentAmount > balance) {
    return {
      ok: false,
      error: `Payment (${paymentAmount}) exceeds remaining balance (${balance}).`,
    };
  }

  const paymentId = id("gbpp");
  const newAmountPaid = passenger.amountPaid + paymentAmount;

  await sql`
    INSERT INTO group_booking_passenger_payments
      (id, tenant_id, passenger_id, amount, paid_at, note)
    VALUES
      (
        ${paymentId},
        ${tenantId},
        ${passengerId},
        ${paymentAmount},
        ${input.paidAt},
        ${input.note ?? null}
      )
  `;

  if (input.proofBuffer && input.proofFileName) {
    await insertGroupBookingPassengerPaymentDocument(
      sql,
      tenantId,
      groupBookingId,
      paymentId,
      "Group split payment proof",
      input.proofFileName,
      input.proofBuffer,
    );
  }

  await sql`
    UPDATE group_booking_passengers
    SET amount_paid = ${newAmountPaid}
    WHERE id = ${passengerId}
  `;

  const allPassengerRows = (await sql`
    SELECT package_price, amount_paid
    FROM group_booking_passengers
    WHERE group_booking_id = ${groupBookingId}
  `) as {
    package_price: number | string | null;
    amount_paid: number | string | null;
    amount: number | string;
  }[];

  const groupStatus = computeGroupBookingStatus(
    allPassengerRows.map((r) => ({
      packagePrice: Number(r.package_price ?? r.amount),
      amountPaid: Number(r.amount_paid ?? 0),
    })),
  );

  await sql`
    UPDATE group_bookings
    SET status = ${groupStatus}
    WHERE id = ${groupBookingId}
  `;

  const updatedPassenger: GroupBookingPassenger = {
    ...passenger,
    amountPaid: newAmountPaid,
  };

  const payment: GroupBookingPassengerPayment = {
    id: paymentId,
    passengerId,
    amount: paymentAmount,
    paidAt: input.paidAt,
    note: input.note,
    createdAt: new Date().toISOString(),
    proofFileName: input.proofFileName,
  };

  return {
    ok: true,
    passenger: updatedPassenger,
    payment,
    groupStatus,
  };
}

export type UpdateGroupPackagePriceResult =
  | { ok: true; packagePrice: number; groupStatus: GroupBookingStatus }
  | { ok: false; error: string };

/** Set the same package price for every passenger on a group booking. */
export async function updateGroupBookingPackagePrice(
  sql: SqlExecutor,
  tenantId: string,
  groupBookingId: string,
  packagePriceRaw: number,
): Promise<UpdateGroupPackagePriceResult> {
  await ensureGroupBookingBalancesSchema(sql);

  const packagePrice = Math.round(packagePriceRaw);
  if (!Number.isFinite(packagePrice) || packagePrice <= 0) {
    return { ok: false, error: "Package price must be a positive amount." };
  }

  const bookingRows = (await sql`
    SELECT id FROM group_bookings
    WHERE id = ${groupBookingId} AND tenant_id = ${tenantId}
    LIMIT 1
  `) as { id: string }[];
  if (!bookingRows[0]) {
    return { ok: false, error: "Group booking not found." };
  }

  const passengerRows = (await sql`
    SELECT
      COALESCE(package_price, amount) AS package_price,
      COALESCE(amount_paid, 0) AS amount_paid,
      amount
    FROM group_booking_passengers
    WHERE group_booking_id = ${groupBookingId}
  `) as {
    package_price: number | string;
    amount_paid: number | string;
    amount: number | string;
  }[];

  if (passengerRows.length === 0) {
    return { ok: false, error: "This group booking has no passengers." };
  }

  const maxPaid = Math.max(
    ...passengerRows.map((r) => Number(r.amount_paid ?? 0)),
  );
  if (packagePrice < maxPaid) {
    return {
      ok: false,
      error: `Package price cannot be less than the highest amount already paid (${maxPaid}).`,
    };
  }

  const passengerCount = passengerRows.length;
  const totalExpected = packagePrice * passengerCount;

  await sql`
    UPDATE group_booking_passengers
    SET package_price = ${packagePrice}
    WHERE group_booking_id = ${groupBookingId}
  `;

  const groupStatus = computeGroupBookingStatus(
    passengerRows.map((r) => ({
      packagePrice,
      amountPaid: Number(r.amount_paid ?? 0),
    })),
  );

  await sql`
    UPDATE group_bookings
    SET
      status = ${groupStatus},
      total_amount = ${totalExpected}
    WHERE id = ${groupBookingId}
      AND tenant_id = ${tenantId}
  `;

  return { ok: true, packagePrice, groupStatus };
}

export async function listGroupBookingFollowUpPayments(
  sql: SqlExecutor,
  tenantId: string,
  groupBookingId: string,
): Promise<GroupBookingPassengerPayment[]> {
  await ensureGroupBookingBalancesSchema(sql);

  const bookingRows = (await sql`
    SELECT id FROM group_bookings
    WHERE id = ${groupBookingId} AND tenant_id = ${tenantId}
    LIMIT 1
  `) as { id: string }[];
  if (!bookingRows[0]) return [];

  const rows = (await sql`
    SELECT
      p.id,
      p.passenger_id,
      p.amount,
      p.paid_at,
      p.note,
      p.created_at,
      (
        SELECT file_name
        FROM group_booking_documents
        WHERE passenger_payment_id = p.id
          AND tenant_id = ${tenantId}
        ORDER BY uploaded_at DESC
        LIMIT 1
      ) AS proof_file_name
    FROM group_booking_passenger_payments p
    JOIN group_booking_passengers gbp ON gbp.id = p.passenger_id
    WHERE gbp.group_booking_id = ${groupBookingId}
      AND p.tenant_id = ${tenantId}
    ORDER BY p.paid_at ASC, p.created_at ASC
  `) as {
    id: string;
    passenger_id: string;
    amount: number | string;
    paid_at: string | Date;
    note: string | null;
    created_at: unknown;
    proof_file_name: string | null;
  }[];

  return rows.map((row) => ({
    id: row.id,
    passengerId: row.passenger_id,
    amount: Number(row.amount),
    paidAt: isoDateSlice(row.paid_at),
    note: row.note ?? undefined,
    createdAt: isoTimestamp(row.created_at),
    proofFileName: row.proof_file_name ?? undefined,
  }));
}
