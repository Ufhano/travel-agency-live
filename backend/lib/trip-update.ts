import type { Trip } from "./types";

type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

export type UpdateTripInput = {
  id?: unknown;
  name?: unknown;
  destination?: unknown;
  departureDate?: unknown;
};

export function parseUpdateTripInput(
  body: UpdateTripInput,
): { ok: true; id: string; patch: Partial<Pick<Trip, "name" | "destination" | "departureDate">> } | { ok: false; error: string } {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return { ok: false, error: "Trip id is required." };

  const patch: Partial<Pick<Trip, "name" | "destination" | "departureDate">> = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { ok: false, error: "Trip name cannot be empty." };
    patch.name = name;
  }

  if (body.destination !== undefined) {
    const destination =
      typeof body.destination === "string" ? body.destination.trim() : "";
    if (!destination) return { ok: false, error: "Destination cannot be empty." };
    patch.destination = destination;
  }

  if (body.departureDate !== undefined) {
    const departureDate =
      typeof body.departureDate === "string" ? body.departureDate.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
      return { ok: false, error: "Departure date must be YYYY-MM-DD." };
    }
    patch.departureDate = departureDate;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  return { ok: true, id, patch };
}

export async function updateTripInNeon(
  sql: SqlExecutor,
  id: string,
  patch: Partial<Pick<Trip, "name" | "destination" | "departureDate">>,
): Promise<Trip | null> {
  const existing = (await sql`
    SELECT id, name, destination, departure_date, capacity, status, accommodation_note
    FROM trips WHERE id = ${id} LIMIT 1
  `) as Array<{
    id: string;
    name: string;
    destination: string;
    departure_date: string;
    capacity: number;
    status: string;
    accommodation_note: string;
  }>;

  const row = existing[0];
  if (!row) return null;

  const name = patch.name ?? row.name;
  const destination = patch.destination ?? row.destination;
  const departureDate = patch.departureDate ?? String(row.departure_date).slice(0, 10);

  await sql`
    UPDATE trips
    SET
      name = ${name},
      destination = ${destination},
      departure_date = ${departureDate}
    WHERE id = ${id}
  `;

  return {
    id: row.id,
    name,
    destination,
    departureDate,
    capacity: row.capacity,
    status: row.status as Trip["status"],
    accommodationNote: row.accommodation_note,
  };
}
