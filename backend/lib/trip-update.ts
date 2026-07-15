import type { Trip } from "./types";
import { parseDepartureFromGroupLabel } from "./match-trip";
import { shiftEmbeddedDatesInLabel } from "./shift-trip-label-dates";

type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

export type UpdateTripInput = {
  id?: unknown;
  name?: unknown;
  destination?: unknown;
  departureDate?: unknown;
  packagePrice?: unknown;
};

export type TripPatch = Partial<
  Pick<Trip, "name" | "destination" | "departureDate" | "packagePrice">
>;

function isoDateSlice(value: unknown): string {
  if (value instanceof Date) {
    /* Neon DATE values arrive as local-midnight Date objects. Using toISOString()
       shifts the calendar day west of UTC (e.g. SAST). Prefer local Y-M-D. */
    const y = value.getFullYear();
    const m = value.getMonth() + 1;
    const d = value.getDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return String(value).slice(0, 10);
}

/**
 * Keep trip title text and traveller balance-due dates aligned when the
 * departure moves (invoices render trip.name, so embedded years matter).
 */
export function syncTripFieldsForDepartureChange(input: {
  name: string;
  destination: string;
  oldDepartureDate: string;
  newDepartureDate: string;
}): {
  name: string;
  destination: string;
  balanceDueDatesToRewrite: string[];
} {
  const { oldDepartureDate, newDepartureDate } = input;
  let { name, destination } = input;

  const nameParsed = parseDepartureFromGroupLabel(name);
  const destParsed = parseDepartureFromGroupLabel(destination);
  const shiftFrom =
    nameParsed ?? destParsed ?? oldDepartureDate;

  const balanceDueDatesToRewrite = new Set<string>();
  if (oldDepartureDate !== newDepartureDate) {
    balanceDueDatesToRewrite.add(oldDepartureDate);
  }
  if (nameParsed && nameParsed !== newDepartureDate) {
    balanceDueDatesToRewrite.add(nameParsed);
  }

  if (shiftFrom !== newDepartureDate) {
    name = shiftEmbeddedDatesInLabel(name, shiftFrom, newDepartureDate);
    destination = shiftEmbeddedDatesInLabel(
      destination,
      shiftFrom,
      newDepartureDate,
    );
  }

  return {
    name,
    destination,
    balanceDueDatesToRewrite: [...balanceDueDatesToRewrite],
  };
}

export function parseUpdateTripInput(
  body: UpdateTripInput,
): { ok: true; id: string; patch: TripPatch } | { ok: false; error: string } {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return { ok: false, error: "Trip id is required." };

  const patch: TripPatch = {};

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

  if (body.packagePrice !== undefined) {
    if (body.packagePrice === null || body.packagePrice === "") {
      patch.packagePrice = null;
    } else {
      const priceRaw =
        typeof body.packagePrice === "number"
          ? body.packagePrice
          : Number(String(body.packagePrice).trim());
      if (!Number.isFinite(priceRaw) || priceRaw < 0) {
        return {
          ok: false,
          error: "Package price must be a non-negative number.",
        };
      }
      patch.packagePrice = priceRaw > 0 ? Math.round(priceRaw) : null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  return { ok: true, id, patch };
}

export async function updateTripInNeon(
  sql: SqlExecutor,
  tenantId: string,
  id: string,
  patch: TripPatch,
): Promise<Trip | null> {
  const existing = (await sql`
    SELECT id, name, destination, departure_date, capacity, status, accommodation_note, public_package_price
    FROM trips WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
  `) as Array<{
    id: string;
    name: string;
    destination: string;
    departure_date: string;
    capacity: number;
    status: string;
    accommodation_note: string;
    public_package_price: number | null;
  }>;

  const row = existing[0];
  if (!row) return null;

  const oldDepartureDate = isoDateSlice(row.departure_date);
  let name = patch.name ?? row.name;
  let destination = patch.destination ?? row.destination;
  const departureDate = patch.departureDate ?? oldDepartureDate;
  const packagePrice =
    patch.packagePrice !== undefined
      ? patch.packagePrice
      : row.public_package_price != null && Number(row.public_package_price) > 0
        ? Number(row.public_package_price)
        : null;

  let balanceDueDatesToRewrite: string[] = [];
  if (patch.departureDate !== undefined) {
    const synced = syncTripFieldsForDepartureChange({
      name,
      destination,
      oldDepartureDate,
      newDepartureDate: departureDate,
    });
    /* Only auto-rewrite labels when the caller did not explicitly rename. */
    if (patch.name === undefined) name = synced.name;
    if (patch.destination === undefined) destination = synced.destination;
    balanceDueDatesToRewrite = synced.balanceDueDatesToRewrite;
  }

  await sql`
    UPDATE trips
    SET
      name = ${name},
      destination = ${destination},
      departure_date = ${departureDate},
      public_package_price = ${packagePrice}
    WHERE id = ${id} AND tenant_id = ${tenantId}
  `;

  for (const oldDue of balanceDueDatesToRewrite) {
    if (oldDue === departureDate) continue;
    await sql`
      UPDATE clients
      SET balance_due_date = ${departureDate}
      WHERE trip_id = ${id}
        AND tenant_id = ${tenantId}
        AND balance_due_date = ${oldDue}
    `;
  }

  return {
    id: row.id,
    name,
    destination,
    departureDate,
    capacity: row.capacity,
    status: row.status as Trip["status"],
    accommodationNote: row.accommodation_note,
    packagePrice,
  };
}
