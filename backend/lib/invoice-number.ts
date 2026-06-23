type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

/**
 * Next sequential INV-0001 style number (padded to 4 digits).
 *
 * `invoice_number` is globally unique across all tenants, so the sequence is
 * computed globally to avoid collisions. The `tenantId` arg is kept for
 * call-site compatibility but is not used for scoping.
 */
export async function nextInvoiceNumber(
  sql: SqlExecutor,
  _tenantId: string,
): Promise<string> {
  const rows = (await sql`
    SELECT invoice_number
    FROM payments
    WHERE invoice_number LIKE 'INV-%'
  `) as { invoice_number: string }[];

  let max = 0;
  for (const row of rows) {
    const m = /^INV-(\d+)$/i.exec(row.invoice_number.trim());
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }

  const next = max + 1;
  return `INV-${String(next).padStart(4, "0")}`;
}
