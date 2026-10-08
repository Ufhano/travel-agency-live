/**
 * When a departure date changes, keep human-readable trip titles in sync
 * (e.g. "Mozambique 08 - 11 October 2025" → "… October 2026").
 */

const MONTH_PATTERN =
  "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";

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

function monthIndex(word: string): number | null {
  const key = word.trim().toLowerCase();
  return MONTHS[key] ?? MONTHS[key.slice(0, 3)] ?? null;
}

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function utcDay(iso: string): number | null {
  const p = parseIso(iso);
  if (!p) return null;
  return Date.UTC(p.y, p.m - 1, p.d) / 86_400_000;
}

function addDaysIso(iso: string, days: number): string | null {
  const p = parseIso(iso);
  if (!p) return null;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** Only rewrite dates that belong to this departure window (not already shifted). */
function belongsToDeparture(iso: string, oldDeparture: string): boolean {
  const a = utcDay(iso);
  const b = utcDay(oldDeparture);
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= 21;
}

function padDay(day: number, sample: string): string {
  return sample.length >= 2 ? String(day).padStart(2, "0") : String(day);
}

function rewriteMonthToken(original: string, month: number): string {
  const target = MONTH_NAMES[month - 1];
  if (!target) return original;
  if (original === original.toUpperCase()) return target.toUpperCase();
  if (original.length <= 4) {
    const abbr = target.slice(0, original.length);
    if (original[0] === original[0]!.toUpperCase()) {
      return abbr[0]!.toUpperCase() + abbr.slice(1).toLowerCase();
    }
    return abbr.toLowerCase();
  }
  if (original[0] === original[0]!.toLowerCase()) return target.toLowerCase();
  return target;
}

function formatDayMonthYear(
  iso: string,
  daySample: string,
  monthSample: string,
): string | null {
  const p = parseIso(iso);
  if (!p) return null;
  return `${padDay(p.d, daySample)} ${rewriteMonthToken(monthSample, p.m)} ${p.y}`;
}

/**
 * Shift every recognisable calendar date in a trip label by the same day delta
 * as oldDeparture → newDeparture. No-op when dates match or inputs are invalid.
 */
export function shiftEmbeddedDatesInLabel(
  label: string,
  oldDeparture: string,
  newDeparture: string,
): string {
  if (!label.trim()) return label;
  if (oldDeparture === newDeparture) return label;

  const oldDay = utcDay(oldDeparture);
  const newDay = utcDay(newDeparture);
  if (oldDay == null || newDay == null) return label;
  const delta = newDay - oldDay;

  let out = label;

  /* "08 - 11 October 2025" / "08-11 Oct 2025" */
  out = out.replace(
    new RegExp(
      `\\b(\\d{1,2})(\\s*[-–—to]+\\s*)(\\d{1,2})(\\s+)(${MONTH_PATTERN})(\\s*,?\\s+)(\\d{4})\\b`,
      "gi",
    ),
    (
      _full,
      d1: string,
      sep: string,
      d2: string,
      sp1: string,
      monthWord: string,
      sp2: string,
      year: string,
    ) => {
      const month = monthIndex(monthWord);
      if (!month) return _full;
      const startIso = `${year}-${String(month).padStart(2, "0")}-${String(Number(d1)).padStart(2, "0")}`;
      const endIso = `${year}-${String(month).padStart(2, "0")}-${String(Number(d2)).padStart(2, "0")}`;
      if (!belongsToDeparture(startIso, oldDeparture)) return _full;
      const startShifted = addDaysIso(startIso, delta);
      const endShifted = addDaysIso(endIso, delta);
      if (!startShifted || !endShifted) return _full;
      const s = parseIso(startShifted)!;
      const e = parseIso(endShifted)!;
      if (s.m === e.m && s.y === e.y) {
        return `${padDay(s.d, d1)}${sep}${padDay(e.d, d2)}${sp1}${rewriteMonthToken(monthWord, s.m)}${sp2}${s.y}`;
      }
      const left = formatDayMonthYear(startShifted, d1, monthWord);
      const right = formatDayMonthYear(endShifted, d2, monthWord);
      if (!left || !right) return _full;
      return `${left}${sep.trim() === sep ? sep : " - "}${right}`;
    },
  );

  /* "30 Aug 2026" / "30 August 2026" */
  out = out.replace(
    new RegExp(
      `\\b(\\d{1,2})(\\s+)(${MONTH_PATTERN})(\\s*,?\\s+)(\\d{4})\\b`,
      "gi",
    ),
    (
      _full,
      day: string,
      sp1: string,
      monthWord: string,
      sp2: string,
      year: string,
    ) => {
      const month = monthIndex(monthWord);
      if (!month) return _full;
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
      if (!belongsToDeparture(iso, oldDeparture)) return _full;
      const shifted = addDaysIso(iso, delta);
      if (!shifted) return _full;
      const p = parseIso(shifted)!;
      return `${padDay(p.d, day)}${sp1}${rewriteMonthToken(monthWord, p.m)}${sp2}${p.y}`;
    },
  );

  /* "Aug 28 - 30, 2026" */
  out = out.replace(
    new RegExp(
      `\\b(${MONTH_PATTERN})(\\s+)(\\d{1,2})(\\s*[-–—to]+\\s*)(\\d{1,2})(\\s*,?\\s+)(\\d{4})\\b`,
      "gi",
    ),
    (
      _full,
      monthWord: string,
      sp1: string,
      d1: string,
      sep: string,
      d2: string,
      sp2: string,
      year: string,
    ) => {
      const month = monthIndex(monthWord);
      if (!month) return _full;
      const startIso = `${year}-${String(month).padStart(2, "0")}-${String(Number(d1)).padStart(2, "0")}`;
      const endIso = `${year}-${String(month).padStart(2, "0")}-${String(Number(d2)).padStart(2, "0")}`;
      if (!belongsToDeparture(startIso, oldDeparture)) return _full;
      const startShifted = addDaysIso(startIso, delta);
      const endShifted = addDaysIso(endIso, delta);
      if (!startShifted || !endShifted) return _full;
      const s = parseIso(startShifted)!;
      const e = parseIso(endShifted)!;
      if (s.m === e.m && s.y === e.y) {
        return `${rewriteMonthToken(monthWord, s.m)}${sp1}${padDay(s.d, d1)}${sep}${padDay(e.d, d2)}${sp2}${s.y}`;
      }
      return _full;
    },
  );

  /* "August 30 2026" */
  out = out.replace(
    new RegExp(
      `\\b(${MONTH_PATTERN})(\\s+)(\\d{1,2})(\\s*,?\\s+)(\\d{4})\\b`,
      "gi",
    ),
    (
      _full,
      monthWord: string,
      sp1: string,
      day: string,
      sp2: string,
      year: string,
    ) => {
      const month = monthIndex(monthWord);
      if (!month) return _full;
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
      if (!belongsToDeparture(iso, oldDeparture)) return _full;
      const shifted = addDaysIso(iso, delta);
      if (!shifted) return _full;
      const p = parseIso(shifted)!;
      return `${rewriteMonthToken(monthWord, p.m)}${sp1}${padDay(p.d, day)}${sp2}${p.y}`;
    },
  );

  /* ISO yyyy-mm-dd */
  out = out.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (iso) => {
    if (!belongsToDeparture(iso, oldDeparture)) return iso;
    return addDaysIso(iso, delta) ?? iso;
  });

  /* Numeric d/m/y */
  out = out.replace(
    /\b(\d{1,2})([/.\-])(\d{1,2})\2(\d{2,4})\b/g,
    (full, d: string, sep: string, m: string, yRaw: string) => {
      let year = Number(yRaw);
      if (year < 100) year += year >= 70 ? 1900 : 2000;
      const iso = `${year}-${String(Number(m)).padStart(2, "0")}-${String(Number(d)).padStart(2, "0")}`;
      if (!belongsToDeparture(iso, oldDeparture)) return full;
      const shifted = addDaysIso(iso, delta);
      if (!shifted) return full;
      const p = parseIso(shifted)!;
      const yOut =
        yRaw.length === 2 ? String(p.y).slice(-2) : String(p.y);
      return `${padDay(p.d, d)}${sep}${padDay(p.m, m)}${sep}${yOut}`;
    },
  );

  return out;
}

function pad2(day: number): string {
  return String(day).padStart(2, "0");
}

function formatExplicitRange(startIso: string, endIso: string | null): string | null {
  const start = parseIso(startIso);
  if (!start) return null;
  const end =
    endIso && endIso !== startIso ? parseIso(endIso) : null;
  const startMonth = MONTH_NAMES[start.m - 1];
  if (!startMonth) return null;
  if (!end || (end.y === start.y && end.m === start.m && end.d === start.d)) {
    return `${pad2(start.d)} ${startMonth} ${start.y}`;
  }
  const endMonth = MONTH_NAMES[end.m - 1];
  if (!endMonth) return null;
  if (end.y === start.y && end.m === start.m) {
    return `${pad2(start.d)} - ${pad2(end.d)} ${startMonth} ${start.y}`;
  }
  return `${pad2(start.d)} ${startMonth} ${start.y} - ${pad2(end.d)} ${endMonth} ${end.y}`;
}

const LABEL_DATE_RE = new RegExp(
  `\\b(?:\\d{1,2}\\s*[-–—]\\s*\\d{1,2}\\s+(?:${MONTH_PATTERN})\\s*,?\\s*\\d{4}|(?:${MONTH_PATTERN})\\s+\\d{1,2}\\s*[-–—]\\s*\\d{1,2}\\s*,?\\s*\\d{4}|\\d{1,2}\\s+(?:${MONTH_PATTERN})\\s*,?\\s*\\d{4}|(?:${MONTH_PATTERN})\\s+\\d{1,2}\\s*,?\\s*\\d{4}|\\d{1,2}\\s*[-–—]\\s*\\d{1,2}\\s+(?:${MONTH_PATTERN})|(?:${MONTH_PATTERN})\\s+\\d{1,2}\\s*[-–—]\\s*\\d{1,2})\\b`,
  "i",
);

/**
 * Replace the first calendar date or stay in a trip title with an explicit
 * range (e.g. "Vic Falls 12 - 16 October 2026" → "… 26 - 30 October 2026").
 * Titles with no date are left unchanged.
 */
export function rewriteLabelToDateRange(
  label: string,
  startIso: string,
  endIso: string | null,
): string {
  if (!label.trim()) return label;
  const next = formatExplicitRange(startIso, endIso);
  if (!next) return label;
  if (!LABEL_DATE_RE.test(label)) return label;
  return label.replace(LABEL_DATE_RE, next);
}
