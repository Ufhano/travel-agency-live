import type { GroupedStructuredData, NormalizedTravelRecord } from "./types";

function pushDistinct(arr: string[], value: string | null | undefined): void {
  if (!value || !value.trim()) return;
  const v = value.trim();
  const low = v.toLowerCase();
  if (arr.some((x) => x.toLowerCase() === low)) return;
  arr.push(v);
}

export function groupByMonth(records: NormalizedTravelRecord[]): GroupedStructuredData {
  const out: GroupedStructuredData = {};

  for (const r of records) {
    const yearKey =
      typeof r.year === "number" && r.year >= 1900 && r.year <= 2100
        ? String(r.year)
        : "Undated";
    const monthKey = r.month?.trim().length ? r.month : "Unknown";

    if (!out[yearKey]) out[yearKey] = {};
    if (!out[yearKey][monthKey]) {
      out[yearKey][monthKey] = {
        destinations: [],
        sectors: [],
        records: [],
      };
    }

    const bucket = out[yearKey][monthKey];
    pushDistinct(bucket.destinations, r.destination);
    pushDistinct(bucket.sectors, r.sector);
    bucket.records.push(r);
  }

  /** Stable sort for presentation */
  for (const y of Object.keys(out)) {
    for (const m of Object.keys(out[y])) {
      const b = out[y][m];
      b.destinations.sort((a, b2) => a.localeCompare(b2, "en"));
      b.sectors.sort((a, b2) => a.localeCompare(b2, "en"));
    }
  }

  return out;
}
