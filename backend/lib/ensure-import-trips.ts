import type { Trip } from "./types";
import {
  destinationFromGroupLabel,
  matchTripForGroup,
  parseDepartureFromGroupLabel,
  tripToOption,
  type TripOption,
  uniqueImportGroups,
} from "./match-trip";
import { createTripInNeon } from "./trip-save";

type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

function defaultDepartureDate(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 3);
  return d.toISOString().slice(0, 10);
}

async function loadTenantTripOptions(
  sql: SqlExecutor,
  tenantId: string,
): Promise<TripOption[]> {
  const rows = (await sql`
    SELECT id, name, destination, departure_date
    FROM trips
    WHERE tenant_id = ${tenantId}
    ORDER BY departure_date ASC
  `) as {
    id: string;
    name: string;
    destination: string;
    departure_date: string | Date;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    destination: r.destination,
    departureDate:
      typeof r.departure_date === "string"
        ? r.departure_date.slice(0, 10)
        : r.departure_date.toISOString().slice(0, 10),
  }));
}

export type EnsureTripsResult = {
  trips: TripOption[];
  groupTripIds: Record<string, string>;
  createdCount: number;
  createdNames: string[];
};

/**
 * Ensure every import group label has a matching departure in Neon.
 * Creates missing trips automatically (one per worksheet tab / group).
 */
export async function ensureTripsForImportGroups(
  sql: SqlExecutor,
  tenantId: string,
  groups: string[],
): Promise<EnsureTripsResult> {
  const uniqueGroups = uniqueImportGroups(groups);
  const trips = await loadTenantTripOptions(sql, tenantId);
  const groupTripIds: Record<string, string> = {};
  const createdNames: string[] = [];
  let createdCount = 0;

  for (const group of uniqueGroups) {
    let tripId = matchTripForGroup(group, trips);
    if (!tripId) {
      const exact = trips.find(
        (t) => t.name.trim().toLowerCase() === group.trim().toLowerCase(),
      );
      if (exact) tripId = exact.id;
    }

    if (tripId) {
      groupTripIds[group] = tripId;
      continue;
    }

    const departureDate =
      parseDepartureFromGroupLabel(group) ?? defaultDepartureDate();
    const input: Omit<Trip, "id"> = {
      name: group,
      destination: destinationFromGroupLabel(group),
      departureDate,
      returnDate: null,
      capacity: 40,
      status: "Open",
      accommodationNote: "",
      packagePrice: null,
    };

    const created = await createTripInNeon(sql, tenantId, input);
    trips.push(tripToOption(created));
    groupTripIds[group] = created.id;
    createdNames.push(group);
    createdCount++;
  }

  trips.sort((a, b) => a.departureDate.localeCompare(b.departureDate));

  return { trips, groupTripIds, createdCount, createdNames };
}
