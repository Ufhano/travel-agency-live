import type { NormalizedTravelRecord } from "./types";

function slugKey(k: string): string {
  return String(k)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function monthNameFromIndex(i: number): string {
  if (i >= 0 && i < 12) return MONTH_NAMES[i];
  return "Unknown";
}

/** Parse numbers with R / $ / ZAR / comma thousands */
export function parseMoney(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  const cleaned = s
    .replace(/^(R|ZAR|USD|\$|£|€)\s*/i, "")
    .replace(/\s/g, "")
    .replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseFlexibleDate(
  v: unknown,
): { iso: string | null; month: string; year: number } | null {
  if (v == null) return null;

  if (v instanceof Date && !Number.isNaN(v.valueOf())) {
    const iso = v.toISOString().slice(0, 10);
    return {
      iso,
      month: monthNameFromIndex(v.getUTCMonth()),
      year: v.getUTCFullYear(),
    };
  }

  if (typeof v === "number" && Number.isFinite(v)) {
    /** Excel serial (approx): only if in plausible range */
    if (v > 20_000 && v < 80_000) {
      const epoch = Date.UTC(1899, 11, 30);
      const ms = epoch + v * 86400_000;
      const d = new Date(ms);
      if (!Number.isNaN(d.valueOf())) {
        return {
          iso: d.toISOString().slice(0, 10),
          month: monthNameFromIndex(d.getUTCMonth()),
          year: d.getUTCFullYear(),
        };
      }
    }
  }

  const s = String(v).trim();
  if (!s) return null;

  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(s);
  if (iso) {
    const d = new Date(`${iso[1]}T00:00:00Z`);
    if (!Number.isNaN(d.valueOf()))
      return {
        iso: iso[1],
        month: monthNameFromIndex(d.getUTCMonth()),
        year: d.getUTCFullYear(),
      };
  }

  const dmy = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/.exec(s);
  if (dmy) {
    const day = Number(dmy[1]);
    const mo = Number(dmy[2]);
    let y = Number(dmy[3]);
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(y, mo - 1, day));
      if (!Number.isNaN(d.valueOf()))
        return {
          iso: d.toISOString().slice(0, 10),
          month: monthNameFromIndex(mo - 1),
          year: y,
        };
    }
  }

  const long = /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s*(\d{4})\b/i.exec(
    s,
  );
  if (long) {
    const dm = `${long[2]} ${long[1]}, ${long[3]}`;
    const d = new Date(dm);
    if (!Number.isNaN(d.valueOf()))
      return {
        iso: d.toISOString().slice(0, 10),
        month: monthNameFromIndex(d.getMonth()),
        year: Number(long[3]),
      };
  }

  return null;
}

function classifyHeaderKey(sk: string): keyof Pick<
  NormalizedTravelRecord,
  "date" | "origin" | "destination" | "sector" | "client" | "amount" | "reference"
> | null {
  if (
    /^(traveldate|departuredate|bookingdate|startdate|enddate)$/.test(sk) ||
    (sk.endsWith("date") &&
      !sk.includes("balance") &&
      !sk.includes("due") &&
      !sk.includes("birth"))
  )
    return "date";

  if (
    sk.includes("fromcity") ||
    sk.includes("departurecity") ||
    sk.includes("departcity") ||
    sk.includes("startingcity") ||
    /^(origin|from)$/.test(sk) ||
    (sk.includes("origin") && !sk.includes("destination")) ||
    (sk.startsWith("from") && !sk.includes("date"))
  )
    return "origin";

  if (
    sk.includes("arrival") ||
    sk.includes("destination") ||
    sk.includes("tocity") ||
    sk.includes("tolocation") ||
    /^to$/.test(sk) ||
    (sk.startsWith("to") &&
      !sk.includes("total") &&
      !sk.includes("tourcode") &&
      sk.length <= 24)
  )
    return "destination";

  if (
    /^sector$|^segment$|^routing$|^leg$|^route$/.test(sk) ||
    sk.includes("sector") ||
    (sk.includes("flight") && !sk.includes("date"))
  )
    return "sector";

  if (
    /^(client|guest|lead|cust|passenger|pax|booker)$/.test(sk) ||
    sk.includes("travelername") ||
    sk.includes("travellername") ||
    (sk.includes("name") &&
      !sk.includes("hotel") &&
      !sk.includes("supplier") &&
      !sk.includes("filename")) ||
    sk === "fullname" ||
    sk === "paxname" ||
    sk === "principal"
  )
    return "client";

  if (
    /^amount$|^fare$|^paid$|^invoiceamount$|^billing$|^total$|^net$|^gross$|^price$/.test(
      sk,
    ) ||
    (sk.includes("amount") && !sk.includes("percentage")) ||
    sk.endsWith("subtotal") ||
    sk.endsWith("paymentamt")
  )
    return "amount";

  if (
    /^ref$|^invoice$|^receipt$|^pnr$|^filekey$/.test(sk) ||
    sk.includes("invoicenumber") ||
    sk.includes("invno") ||
    sk.includes("reference") ||
    sk.includes("bookingref")
  )
    return "reference";

  return null;
}

function gatherFromRow(
  row: Record<string, unknown>,
): Partial<Record<keyof NormalizedTravelRecord, unknown>> {
  const acc: Partial<Record<keyof NormalizedTravelRecord, unknown>> = {};

  for (const [rawKey, val] of Object.entries(row)) {
    if (rawKey.startsWith("_")) continue;
    if (val == null) continue;
    const sk = slugKey(rawKey);
    if (!sk) continue;
    const field = classifyHeaderKey(sk);
    if (field) {
      const cur = acc[field];
      if (cur == null || cur === "") acc[field] = val;
    }
  }

  /** Value-only heuristics when headers are useless (e.g. OCR gluing) */
  if (acc.amount == null) {
    for (const v of Object.values(row)) {
      const m = parseMoney(v);
      if (m != null && m >= 20) {
        acc.amount = m;
        break;
      }
    }
  }

  return acc;
}

export function normalizeRecord(
  row: Record<string, unknown>,
  logs: string[],
): NormalizedTravelRecord | null {
  try {
    const acc = gatherFromRow(row);

    const datePick =
      parseFlexibleDate(acc.date) ??
      parseFlexibleDate((row as { Date?: unknown }).Date) ??
      parseFlexibleDate((row as { date?: unknown }).date);

    const dateIso = datePick?.iso ?? null;
    const month = datePick?.month ?? "Unknown";
    const year =
      typeof datePick?.year === "number" && Number.isFinite(datePick.year)
        ? datePick.year
        : 0;

    const origin =
      acc.origin != null && String(acc.origin).trim()
        ? String(acc.origin).trim()
        : null;
    const destination =
      acc.destination != null && String(acc.destination).trim()
        ? String(acc.destination).trim()
        : null;

    let sector =
      acc.sector != null && String(acc.sector).trim()
        ? String(acc.sector).trim()
        : null;
    if (!sector && origin && destination) sector = `${origin} → ${destination}`;

    const client =
      acc.client != null && String(acc.client).trim()
        ? String(acc.client).trim()
        : null;

    const amount = acc.amount != null ? parseMoney(acc.amount) : null;

    const reference =
      acc.reference != null && String(acc.reference).trim()
        ? String(acc.reference).trim()
        : null;

    const hasAny =
      dateIso ??
      origin ??
      destination ??
      client ??
      amount ??
      reference ??
      sector;
    if (!hasAny) {
      logs.push("Skipped row: no mappable fields after normalization.");
      return null;
    }

    return {
      date: dateIso,
      month,
      year,
      origin,
      destination,
      sector,
      client,
      amount,
      reference,
    };
  } catch (e) {
    logs.push(
      `Row normalization error: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}

export function normalizeRecords(
  rows: Record<string, unknown>[],
  logs: string[],
): NormalizedTravelRecord[] {
  const out: NormalizedTravelRecord[] = [];
  for (const row of rows) {
    const n = normalizeRecord(row, logs);
    if (n) out.push(n);
  }
  logs.push(`Normalized ${out.length} / ${rows.length} row(s).`);
  return out;
}
