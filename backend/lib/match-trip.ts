import type { Trip } from "./types";

export type TripOption = {
  id: string;
  name: string;
  destination: string;
  departureDate: string;
};

export function tripToOption(t: Trip): TripOption {
  return {
    id: t.id,
    name: t.name,
    destination: t.destination,
    departureDate: t.departureDate,
  };
}

/** Match a destination/group label to the best trip by name or destination. */
export function matchTripForGroup(
  group: string,
  trips: TripOption[],
): string {
  const g = group.trim().toLowerCase();
  if (!g || g === "uncategorized" || trips.length === 0) return "";

  for (const t of trips) {
    if (t.name.trim().toLowerCase() === g) return t.id;
  }

  for (const t of trips) {
    const name = t.name.trim().toLowerCase();
    if (!name) continue;
    if (g.includes(name) || name.includes(g)) return t.id;
  }

  return "";
}

/** Guess destination from a worksheet tab / group label. */
export function destinationFromGroupLabel(group: string): string {
  const trimmed = group.trim();
  if (!trimmed || trimmed.toLowerCase() === "uncategorized") return trimmed;
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/** Parse "28 - 30 Aug 2026" or "08 - 10 July 2026" from a sheet title. */
export function parseDepartureFromGroupLabel(group: string): string | null {
  const m = group.match(
    /(\d{1,2})\s*[-–]\s*\d{1,2}\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})/i,
  );
  if (!m) return null;
  const day = Number(m[1]);
  const monthKey = m[2]!.toLowerCase().slice(0, 3);
  const year = Number(m[3]);
  const month = MONTHS[monthKey] ?? MONTHS[m[2]!.toLowerCase()];
  if (!month || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function uniqueImportGroups(groups: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of groups) {
    const g = raw.trim();
    if (!g || g.toLowerCase() === "uncategorized") continue;
    const key = g.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}
