/**
 * Guards against corrupted payment-date years (e.g. a spreadsheet typo or parse
 * glitch turning 2026 into 2926 or 20226). Travel-agency payments are always
 * recent, so any year outside [2000, 2100] is treated as a data-entry mistake
 * and rebuilt from its last two digits (2926 -> 2026, 20226 -> 2026).
 */
export function clampPaymentYear(year: number): number {
  if (!Number.isFinite(year)) return year;
  const y = Math.trunc(year);
  if (y >= 2000 && y <= 2100) return y;
  return 2000 + (((y % 100) + 100) % 100);
}

/**
 * Re-maps an out-of-range year inside an ISO date string (`yyyy-mm-dd` or a full
 * timestamp). Non-ISO strings are returned unchanged.
 */
export function sanitizeIsoYear(iso: string): string {
  const m = /^(\d{4,})(-\d{2}-\d{2}.*)$/.exec(iso);
  if (!m) return iso;
  const year = clampPaymentYear(Number.parseInt(m[1]!, 10));
  return `${String(year).padStart(4, '0')}${m[2]}`;
}
