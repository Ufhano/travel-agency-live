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

const MONTH_PATTERN =
  "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";

function monthIndex(word: string): number | null {
  const key = word.trim().toLowerCase();
  return MONTHS[key] ?? MONTHS[key.slice(0, 3)] ?? null;
}

function toIso(year: number, month: number, day: number): string | null {
  if (!month || month < 1 || month > 12) return null;
  if (!day || day < 1 || day > 31) return null;
  if (year < 1980 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parse the departure date out of a sheet / group title. Handles the common
 * shapes travel sheets use (the start day is used for ranges):
 *  - "28 - 30 Aug 2026" / "08 - 10 July 2026"  (day range, month after)
 *  - "30 Aug 2026" / "30 August 2026"          (single day, month after)
 *  - "Aug 28 - 30, 2026" / "August 30 2026"    (month first)
 *  - "2026-08-28"                              (ISO)
 *  - "28/08/2026" / "28-08-2026"               (numeric d/m/y)
 */
export function parseDepartureFromGroupLabel(group: string): string | null {
  const s = group.trim();
  if (!s) return null;

  /* ISO yyyy-mm-dd anywhere in the label. */
  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const hit = toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (hit) return hit;
  }

  /* "28 - 30 Aug 2026" or "30 Aug 2026" (optional range, month after day). */
  const dayFirst = s.match(
    new RegExp(
      `\\b(\\d{1,2})(?:\\s*[-–—to]+\\s*\\d{1,2})?\\s+(${MONTH_PATTERN})\\s*,?\\s+(\\d{4})\\b`,
      "i",
    ),
  );
  if (dayFirst) {
    const month = monthIndex(dayFirst[2]!);
    if (month) {
      const hit = toIso(Number(dayFirst[3]), month, Number(dayFirst[1]));
      if (hit) return hit;
    }
  }

  /* "Aug 28 - 30, 2026" or "August 30 2026" (month before day). */
  const monthFirst = s.match(
    new RegExp(
      `\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:\\s*[-–—to]+\\s*\\d{1,2})?\\s*,?\\s+(\\d{4})\\b`,
      "i",
    ),
  );
  if (monthFirst) {
    const month = monthIndex(monthFirst[1]!);
    if (month) {
      const hit = toIso(Number(monthFirst[3]), month, Number(monthFirst[2]));
      if (hit) return hit;
    }
  }

  /* Numeric d/m/y: "28/08/2026", "28-08-2026", "28.08.26". */
  const numeric = s.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = Number(numeric[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const hit = toIso(year, month, day);
    if (hit) return hit;
  }

  return null;
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
