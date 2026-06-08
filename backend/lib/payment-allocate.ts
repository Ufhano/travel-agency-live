import { randomBytes } from "node:crypto";

import { payments as memoryPayments } from "./data";
import { nextInvoiceNumber } from "./invoice-number";

type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

function id(prefix: string): string {
  return `${prefix}-${randomBytes(9).toString("hex")}`;
}

export type PaymentAllocation = {
  tripId: string;
  amount: number;
};

export type AllocatePaymentInput = {
  clientId: string;
  totalAmount: number;
  allocations: PaymentAllocation[];
  method?: string;
  note?: string;
};

export type AllocatePaymentResult =
  | {
      ok: true;
      payments: {
        paymentId: string;
        tripId: string;
        amount: number;
        invoiceNumber: string;
      }[];
    }
  | { ok: false; error: string };

function nextMemoryInvoiceNumber(): string {
  let max = 0;
  for (const p of memoryPayments) {
    const m = /^INV-(\d+)$/i.exec(p.invoiceNumber.trim());
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return `INV-${String(max + 1).padStart(4, "0")}`;
}

export async function allocatePaymentToTrips(
  sql: SqlExecutor | null,
  tenantId: string,
  input: AllocatePaymentInput,
): Promise<AllocatePaymentResult> {
  const { clientId, totalAmount, allocations } = input;

  if (!clientId.trim()) return { ok: false, error: "Client is required." };
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { ok: false, error: "Total payment amount must be positive." };
  }
  if (!allocations.length) {
    return { ok: false, error: "Select at least one trip allocation." };
  }

  const sum = allocations.reduce((s, a) => s + a.amount, 0);
  if (Math.round(sum) !== Math.round(totalAmount)) {
    return {
      ok: false,
      error: `Allocation total (${sum}) must equal payment amount (${totalAmount}).`,
    };
  }

  const method = input.method?.trim() || "Allocation";
  const note = input.note?.trim() || null;
  const paidAt = new Date().toISOString();

  const created: {
    paymentId: string;
    tripId: string;
    amount: number;
    invoiceNumber: string;
  }[] = [];

  if (!sql) {
    const { clients: memoryClients, trips: memoryTrips } = await import(
      "./data"
    );
    const client = memoryClients.find((c) => c.id === clientId);
    if (!client) return { ok: false, error: "Client not found." };

    for (const alloc of allocations) {
      if (!alloc.tripId.trim()) {
        return { ok: false, error: "Each allocation needs a trip." };
      }
      if (!Number.isFinite(alloc.amount) || alloc.amount <= 0) {
        return { ok: false, error: "Each allocation amount must be positive." };
      }
      if (!memoryTrips.some((t) => t.id === alloc.tripId)) {
        return { ok: false, error: `Trip not found: ${alloc.tripId}` };
      }

      const paymentId = id("p");
      const invoiceNumber = nextMemoryInvoiceNumber();
      memoryPayments.push({
        id: paymentId,
        invoiceNumber,
        clientId,
        tripId: alloc.tripId,
        amount: Math.round(alloc.amount),
        paidAt,
        method,
        note: note ?? undefined,
      });

      created.push({
        paymentId,
        tripId: alloc.tripId,
        amount: Math.round(alloc.amount),
        invoiceNumber,
      });
    }

    return { ok: true, payments: created };
  }

  const clientRows = (await sql`
    SELECT id FROM clients WHERE id = ${clientId} AND tenant_id = ${tenantId} LIMIT 1
  `) as { id: string }[];
  if (!clientRows[0]) return { ok: false, error: "Client not found." };

  for (const alloc of allocations) {
    if (!alloc.tripId.trim()) {
      return { ok: false, error: "Each allocation needs a trip." };
    }
    if (!Number.isFinite(alloc.amount) || alloc.amount <= 0) {
      return { ok: false, error: "Each allocation amount must be positive." };
    }

    const tripRows = (await sql`
      SELECT id FROM trips WHERE id = ${alloc.tripId} AND tenant_id = ${tenantId} LIMIT 1
    `) as { id: string }[];
    if (!tripRows[0]) {
      return { ok: false, error: `Trip not found: ${alloc.tripId}` };
    }

    const paymentId = id("p");
    const invoiceNumber = await nextInvoiceNumber(sql, tenantId);

    await sql`
      INSERT INTO payments (id, tenant_id, invoice_number, client_id, trip_id, amount, paid_at, method, note)
      VALUES (
        ${paymentId},
        ${tenantId},
        ${invoiceNumber},
        ${clientId},
        ${alloc.tripId},
        ${Math.round(alloc.amount)},
        ${paidAt},
        ${method},
        ${note}
      )
    `;

    created.push({
      paymentId,
      tripId: alloc.tripId,
      amount: Math.round(alloc.amount),
      invoiceNumber,
    });
  }

  return { ok: true, payments: created };
}
