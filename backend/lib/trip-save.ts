import { randomBytes } from "node:crypto";

import type { Trip, TripStatus } from "./types";

type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

const TRIP_STATUSES: TripStatus[] = [
  "Draft",
  "Open",
  "Filling Fast",
  "Under-filled",
  "Confirmed",
  "Closed",
];

function id(prefix: string): string {
  return `${prefix}-${randomBytes(9).toString("hex")}`;
}

function defaultDepartureDate(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 3);
  return d.toISOString().slice(0, 10);
}

export type CreateTripInput = {
  name?: unknown;
  destination?: unknown;
  departureDate?: unknown;
  capacity?: unknown;
  status?: unknown;
  accommodationNote?: unknown;
};

export function parseCreateTripInput(
  body: CreateTripInput,
): { ok: true; trip: Omit<Trip, "id"> } | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const destination =
    typeof body.destination === "string" ? body.destination.trim() : "";
  const departureDate =
    typeof body.departureDate === "string" ? body.departureDate.trim() : "";
  const accommodationNote =
    typeof body.accommodationNote === "string"
      ? body.accommodationNote.trim()
      : "";

  if (!name) return { ok: false, error: "Trip name is required." };
  if (!destination) return { ok: false, error: "Destination is required." };

  const dep =
    departureDate && /^\d{4}-\d{2}-\d{2}$/.test(departureDate)
      ? departureDate
      : defaultDepartureDate();

  const capRaw =
    typeof body.capacity === "number"
      ? body.capacity
      : Number(String(body.capacity ?? "").trim());
  const capacity =
    Number.isFinite(capRaw) && capRaw > 0 ? Math.round(capRaw) : 40;

  const statusRaw =
    typeof body.status === "string" ? body.status.trim() : "Open";
  const status = TRIP_STATUSES.includes(statusRaw as TripStatus)
    ? (statusRaw as TripStatus)
    : "Open";

  return {
    ok: true,
    trip: {
      name,
      destination,
      departureDate: dep,
      capacity,
      status,
      accommodationNote,
    },
  };
}

export async function createTripInNeon(
  sql: SqlExecutor,
  input: Omit<Trip, "id">,
): Promise<Trip> {
  const tripId = id("t");
  await sql`
    INSERT INTO trips
      (id, name, destination, departure_date, capacity, status, accommodation_note)
    VALUES
      (
        ${tripId},
        ${input.name},
        ${input.destination},
        ${input.departureDate},
        ${input.capacity},
        ${input.status},
        ${input.accommodationNote}
      )
  `;
  return { id: tripId, ...input };
}
