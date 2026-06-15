import { getSql } from "./db";
import { payments as memoryPayments } from "./data";
import { getTripTenant } from "./tenant-scope";

export type DeletePaymentResult =
  | { ok: true; deletedId: string; invoiceNumber: string }
  | { ok: false; error: string; status?: number };

export async function deletePaymentById(
  paymentId: string,
  tenantId: string,
): Promise<DeletePaymentResult> {
  const id = paymentId.trim();
  if (!id) return { ok: false, error: "Payment id is required.", status: 400 };

  const sql = getSql();
  if (!sql) {
    const idx = memoryPayments.findIndex((p) => p.id === id);
    if (idx < 0) return { ok: false, error: "Invoice not found.", status: 404 };
    const payment = memoryPayments[idx]!;
    if (getTripTenant(payment.tripId) !== tenantId) {
      return { ok: false, error: "Invoice not found.", status: 404 };
    }
    memoryPayments.splice(idx, 1);
    return {
      ok: true,
      deletedId: payment.id,
      invoiceNumber: payment.invoiceNumber,
    };
  }

  try {
    const rows = (await sql`
      DELETE FROM payments
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING id, invoice_number
    `) as Array<{ id: string; invoice_number: string }>;
    if (rows.length === 0)
      return { ok: false, error: "Invoice not found.", status: 404 };
    return {
      ok: true,
      deletedId: rows[0]!.id,
      invoiceNumber: rows[0]!.invoice_number,
    };
  } catch (e) {
    console.error("[deletePaymentById]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Delete failed.",
      status: 500,
    };
  }
}
