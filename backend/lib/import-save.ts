import { randomBytes } from "node:crypto";

import type { ImportExtractResult } from "./import-parse";

type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

function id(prefix: string): string {
  return `${prefix}-${randomBytes(9).toString("hex")}`;
}

export function validateImportRow(row: ImportExtractResult): string | null {
  if (!row.client.fullName?.trim()) return "Missing client full name.";
  return null;
}

function defaultBalanceDue(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 60);
  return d.toISOString().slice(0, 10);
}

function parseIsoDateOnly(s: string | null | undefined): string | null {
  if (!s?.trim()) return null;
  const t = s.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

function paidAtIso(row: ImportExtractResult): string {
  const raw = row.payment.paidAt?.trim();
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.valueOf())) return d.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Inserts one client (+ optional payment) for an existing trip. Caller must verify `tripId` exists.
 */
export async function saveImportExtractToNeon(
  sql: SqlExecutor,
  tripId: string,
  row: ImportExtractResult,
): Promise<
  | { ok: true; clientId: string; paymentId?: string; paymentError?: string }
  | { ok: false; error: string }
> {
  const v = validateImportRow(row);
  if (v) return { ok: false, error: v };

  const tripCheck = (await sql`
    SELECT id FROM trips WHERE id = ${tripId} LIMIT 1
  `) as { id: string }[];
  if (!tripCheck[0]) return { ok: false, error: "Trip not found." };

  const clientId = id("c");
  const fullName = row.client.fullName!.trim();
  const phone = row.client.phone?.trim() || "—";
  const email = row.client.email?.trim() || "pending@import.local";
  const pkg = Math.max(
    0,
    Math.round(
      row.client.packagePrice ??
        row.payment.amount ??
        0,
    ),
  );
  const balanceDue = parseIsoDateOnly(row.client.balanceDueDate) ?? defaultBalanceDue();

  await sql`
    INSERT INTO clients (id, trip_id, full_name, phone, email, package_price, balance_due_date)
    VALUES (
      ${clientId},
      ${tripId},
      ${fullName},
      ${phone},
      ${email},
      ${pkg},
      ${balanceDue}
    )
  `;

  const amt = row.payment.amount;
  if (amt != null && amt > 0) {
    const paymentId = id("p");
    const baseInv =
      row.payment.invoiceNumber?.trim() ||
      `IMP-${Date.now()}-${randomBytes(3).toString("hex")}`;
    const inv = baseInv.slice(0, 120);
    const method = row.payment.method?.trim() || "Import";
    const note = row.payment.note?.trim() || null;
    try {
      await sql`
        INSERT INTO payments (id, invoice_number, client_id, trip_id, amount, paid_at, method, note)
        VALUES (
          ${paymentId},
          ${inv},
          ${clientId},
          ${tripId},
          ${Math.round(amt)},
          ${paidAtIso(row)},
          ${method},
          ${note}
        )
      `;
      return { ok: true, clientId, paymentId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: true,
        clientId,
        paymentError: `Traveller saved; payment row skipped: ${msg}`,
      };
    }
  }

  return { ok: true, clientId };
}
