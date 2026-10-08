import {clsx, type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatZAR(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** ZAR with two decimals — matches formal invoices and receipts. */
export function formatZARInvoice(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format an integer amount with a 3-letter currency code (whole units). */
export function formatMoney(amount: number, currency: string): string {
  const code = currency.trim().toUpperCase() || 'ZAR';
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString('en-ZA')}`;
  }
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function isoParts(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** "26 Oct 2026", or "26–30 Oct 2026" when the trip has a return day. */
export function formatTripDates(
  departureIso: string,
  returnIso?: string | null,
): string {
  const start = isoParts(departureIso);
  if (!start) return formatDate(departureIso);
  const end = returnIso ? isoParts(returnIso) : null;
  const startMonth = SHORT_MONTHS[start.m - 1];
  if (
    !end ||
    !startMonth ||
    (end.y === start.y && end.m === start.m && end.d === start.d)
  ) {
    return formatDate(departureIso);
  }
  const endMonth = SHORT_MONTHS[end.m - 1];
  if (!endMonth) return formatDate(departureIso);
  if (end.y === start.y && end.m === start.m) {
    return `${start.d}–${end.d} ${startMonth} ${start.y}`;
  }
  return `${start.d} ${startMonth} ${start.y} – ${end.d} ${endMonth} ${end.y}`;
}

export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_EMAILS = new Set([
  'insert@email.com',
  'n/a',
  'na',
  'none',
  '—',
]);

/** True when the client has a real email (not import placeholder). */
export function hasRealClientEmail(email: string | null | undefined): boolean {
  const trimmed = email?.trim();
  if (!trimmed) return false;
  if (PLACEHOLDER_EMAILS.has(trimmed.toLowerCase())) return false;
  return EMAIL_RE.test(trimmed);
}

/** Long-form date for today (e.g. 8 June 2026). */
export function formatTodayLong(): string {
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
