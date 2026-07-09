import { randomBytes } from "node:crypto";

import { insertGroupBookingDocument } from "./documents";
import type {
  GroupBookingListItem,
  GroupBookingPassenger,
  GroupBookingStatus,
  GroupBookingWithPassengers,
  PassengerPaidStatus,
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

function parsePaidStatus(raw: string): PassengerPaidStatus {
  return raw === "paid" ? "paid" : "unpaid";
}

function parseGroupStatus(raw: string): GroupBookingStatus {
  if (raw === "Partial" || raw === "Complete") return raw;
  return "Pending";
}

export function computeGroupBookingStatus(
  passengers: { paidStatus: PassengerPaidStatus }[],
): GroupBookingStatus {
  if (passengers.length === 0) return "Pending";
  const paidCount = passengers.filter((p) => p.paidStatus === "paid").length;
  if (paidCount === 0) return "Pending";
  if (paidCount === passengers.length) return "Complete";
  return "Partial";
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
  const paidAt =
    typeof form.get("paidAt") === "string"
      ? String(form.get("paidAt")).trim()
      : "";
  const passengersRaw = form.get("passengers");

  if (!tripId) return { ok: false, error: "Trip is required." };
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { ok: false, error: "Total amount must be a positive number." };
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
  paid_status: string;
  created_at: unknown;
}): GroupBookingPassenger {
  return {
    id: row.id,
    groupBookingId: row.group_booking_id,
    passengerName: row.passenger_name,
    passengerEmail: row.passenger_email,
    amount: Number(row.amount),
    paidStatus: parsePaidStatus(row.paid_status),
    createdAt: isoTimestamp(row.created_at),
  };
}

export async function createGroupBooking(
  sql: SqlClient,
  tenantId: string,
  input: CreateGroupBookingInput,
): Promise<CreateGroupBookingResult> {
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
  const status: GroupBookingStatus = "Pending";

  const passengerRecords = input.passengers.map((p) => ({
    id: id("gbp"),
    passengerName: p.passengerName,
    passengerEmail: p.passengerEmail,
    amount: p.amount,
  }));

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
          (id, group_booking_id, passenger_name, passenger_email, amount, paid_status)
        VALUES
          (
            ${p.id},
            ${groupBookingId},
            ${p.passengerName},
            ${p.passengerEmail},
            ${p.amount},
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
    amount: p.amount,
    paidStatus: "unpaid",
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
      COUNT(gbp.id)::int AS passenger_count
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
  }));
}

export async function getGroupBookingById(
  sql: SqlExecutor,
  tenantId: string,
  groupBookingId: string,
): Promise<GroupBookingWithPassengers | null> {
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
        WHERE group_booking_id = gb.id AND tenant_id = gb.tenant_id
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
      paid_status,
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
    paid_status: string;
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

export type UpdatePassengerPaidStatusResult =
  | { ok: true; passenger: GroupBookingPassenger; groupStatus: GroupBookingStatus }
  | { ok: false; error: string };

export async function updatePassengerPaidStatus(
  sql: SqlExecutor,
  tenantId: string,
  groupBookingId: string,
  passengerId: string,
  paidStatus: PassengerPaidStatus,
): Promise<UpdatePassengerPaidStatusResult> {
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
      id,
      group_booking_id,
      passenger_name,
      passenger_email,
      amount,
      paid_status,
      created_at
    FROM group_booking_passengers
    WHERE id = ${passengerId} AND group_booking_id = ${groupBookingId}
    LIMIT 1
  `) as {
    id: string;
    group_booking_id: string;
    passenger_name: string;
    passenger_email: string;
    amount: number | string;
    paid_status: string;
    created_at: unknown;
  }[];

  if (!passengerRows[0]) {
    return { ok: false, error: "Passenger not found." };
  }

  await sql`
    UPDATE group_booking_passengers
    SET paid_status = ${paidStatus}
    WHERE id = ${passengerId}
  `;

  const allPassengerRows = (await sql`
    SELECT paid_status
    FROM group_booking_passengers
    WHERE group_booking_id = ${groupBookingId}
  `) as { paid_status: string }[];

  const groupStatus = computeGroupBookingStatus(
    allPassengerRows.map((r) => ({
      paidStatus: parsePaidStatus(r.paid_status),
    })),
  );

  await sql`
    UPDATE group_bookings
    SET status = ${groupStatus}
    WHERE id = ${groupBookingId}
  `;

  const updated = mapPassengerRow({
    ...passengerRows[0],
    paid_status: paidStatus,
  });

  return { ok: true, passenger: updated, groupStatus };
}
