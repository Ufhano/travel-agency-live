type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

/** Next sequential INV-0001 style number for a tenant (padded to 4 digits). */
export async function nextInvoiceNumber(
  sql: SqlExecutor,
  tenantId: string,
): Promise<string> {
  const rows = (await sql`
    SELECT invoice_number
    FROM payments
    WHERE tenant_id = ${tenantId}
      AND invoice_number LIKE 'INV-%'
  `) as { invoice_number: string }[];

  let max = 0;
  for (const row of rows) {
    const m = /^INV-(\d+)$/i.exec(row.invoice_number.trim());
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }

  const next = max + 1;
  return `INV-${String(next).padStart(4, "0")}`;
}
