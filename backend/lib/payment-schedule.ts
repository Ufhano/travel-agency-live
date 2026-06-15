import type { Payment } from "./types";

export type PaymentInstallment = {
  label: string;
  amount: number;
  /** ISO date (yyyy-mm-dd) — first of the instalment month */
  paidAt: string;
};

export type MonthlyInstallment = {
  month: string;
  amount: number;
  paidAt?: string;
};

const INSTALMENT_NOTE_RE =
  /\b([A-Za-z]{3,9}-\d{2,4})\s*:\s*R?\s*([\d][\d,]*(?:\.\d{2})?)/gi;

const INSTALMENT_LABEL_RE = /^([A-Za-z]{3,9}-\d{2,4})\s+instalment$/i;

/** Parse "Dec-25: R2000 · Jan-26: R1500" from imported payment notes. */
export function parseInstallmentsFromPaymentNote(
  note: string | null | undefined,
): MonthlyInstallment[] {
  if (!note?.trim()) return [];

  const out: MonthlyInstallment[] = [];
  for (const part of note.split("·")) {
    const chunk = part.trim();
    if (!chunk || /^row outstanding\b/i.test(chunk)) continue;

    INSTALMENT_NOTE_RE.lastIndex = 0;
    const m = INSTALMENT_NOTE_RE.exec(chunk);
    if (!m) continue;

    const amount = Number.parseFloat(m[2]!.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    out.push({ month: m[1]!, amount: Math.round(amount) });
  }
  return out;
}

function monthLabelFromPaymentNote(note: string | null | undefined): string | null {
  if (!note?.trim()) return null;
  const m = INSTALMENT_LABEL_RE.exec(note.trim());
  return m?.[1] ?? null;
}

export function formatMonthFromPaidAt(paidAt: string): string {
  const d = new Date(paidAt);
  if (Number.isNaN(d.valueOf())) return paidAt.slice(0, 10);
  return new Intl.DateTimeFormat("en-ZA", {
    month: "short",
    year: "2-digit",
  })
    .format(d)
    .replace(/\s+/g, "-");
}

const MONTH_INDEX: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function monthLabelToIsoDate(label: string): string | null {
  const m = /^([A-Za-z]{3,9})-(\d{2,4})$/.exec(label.trim());
  if (!m) return null;
  const token = m[1]!.toLowerCase();
  const month =
    MONTH_INDEX[token] ?? MONTH_INDEX[token.slice(0, 3)] ?? null;
  if (!month) return null;
  let year = Number.parseInt(m[2]!, 10);
  if (!Number.isFinite(year)) return null;
  if (year < 100) year += 2000;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function sortInstallments(items: MonthlyInstallment[]): MonthlyInstallment[] {
  return [...items].sort((a, b) => {
    const da = a.paidAt ?? monthLabelToIsoDate(a.month) ?? "";
    const db = b.paidAt ?? monthLabelToIsoDate(b.month) ?? "";
    if (da && db) return da.localeCompare(db);
    return a.month.localeCompare(b.month);
  });
}

/** Monthly breakdown for a client profile — from instalment rows or legacy import notes. */
export function collectClientMonthlyInstallments(
  payments: Payment[],
): MonthlyInstallment[] {
  const instalmentRows = payments.filter(
    (p) => p.method === "Instalment" && p.amount > 0,
  );
  if (instalmentRows.length > 0) {
    return sortInstallments(
      instalmentRows.map((p) => ({
        month:
          monthLabelFromPaymentNote(p.note) ?? formatMonthFromPaidAt(p.paidAt),
        amount: p.amount,
        paidAt: p.paidAt.slice(0, 10),
      })),
    );
  }

  for (const p of payments) {
    const parsed = parseInstallmentsFromPaymentNote(p.note);
    if (parsed.length > 0) {
      return sortInstallments(
        parsed.map((p) => ({
          ...p,
          paidAt: p.paidAt ?? monthLabelToIsoDate(p.month) ?? undefined,
        })),
      );
    }
  }

  return [];
}

/** Month label for a single payment row (receipts table). */
export function paymentMonthLabel(p: Payment): string | null {
  const fromInstalmentNote = monthLabelFromPaymentNote(p.note);
  if (fromInstalmentNote) return fromInstalmentNote;

  if (p.method === "Instalment" && p.paidAt) {
    return formatMonthFromPaidAt(p.paidAt);
  }

  const parsed = parseInstallmentsFromPaymentNote(p.note);
  if (parsed.length === 1) return parsed[0]!.month;

  return null;
}
