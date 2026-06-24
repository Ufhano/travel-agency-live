import { InvoicesLedgerTable } from "@/components/invoices-ledger-table";
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { createCompute } from "@backend/compute";
import { loadAppDataForPage } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const { data, dbError } = await loadAppDataForPage();
  const { allPaymentsEnriched } = createCompute(data);

  const rows = allPaymentsEnriched().map((r) => ({
    id: r.id,
    invoiceNumber: r.invoiceNumber,
    paidAt: r.paidAt,
    clientId: r.client.id,
    clientName: r.client.fullName,
    tripId: r.trip.id,
    tripName: r.trip.name,
    amount: r.amount,
    totalPaidAfter: r.totalPaidAfter,
    balanceAfter: r.balanceAfter,
  }));

  return (
    <div className="space-y-6">
      {dbError ? <DbConnectionBanner message={dbError} /> : null}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoice ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every payment is a permanent row: unique invoice number, running balance,
          and full audit trail — no overwriting a single template.
        </p>
      </div>

      <InvoicesLedgerTable rows={rows} />
    </div>
  );
}
