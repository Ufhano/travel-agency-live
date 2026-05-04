import type { PaymentWithContext } from "@backend/types";
import { formatDate, formatDateTime, formatZAR } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

export function InvoicePrintBody({ ctx }: { ctx: PaymentWithContext }) {
  return (
    <div
      id="invoice-print"
      className="mx-auto max-w-3xl rounded-xl border bg-card p-8 shadow-sm print:shadow-none print:border-0"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Tax invoice / receipt
          </p>
          <h1 className="mt-1 font-mono text-2xl font-bold tracking-tight">
            {ctx.invoiceNumber}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Nendila Travel Explorers · Internal preview (non-production)
          </p>
          <p className="mt-3 max-w-md border-l-2 border-primary pl-3 text-xs leading-relaxed text-muted-foreground">
            <strong className="font-medium text-foreground">
              Each payment creates a unique invoice record.
            </strong>{" "}
            This receipt is one row in the ledger — previous invoices are never
            replaced when new money comes in.
          </p>
        </div>
        <div className="text-right text-sm">
          <p>
            <span className="text-muted-foreground">Issued</span>
            <br />
            <span className="font-medium">{formatDate(ctx.paidAt)}</span>
          </p>
          <p className="mt-2">
            <span className="text-muted-foreground">Transaction time</span>
            <br />
            <span>{formatDateTime(ctx.paidAt)}</span>
          </p>
        </div>
      </div>

      <Separator className="my-6" />

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Bill to
          </p>
          <p className="mt-1 font-semibold">{ctx.client.fullName}</p>
          <p className="text-sm text-muted-foreground">{ctx.client.email}</p>
          <p className="text-sm text-muted-foreground">{ctx.client.phone}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Trip
          </p>
          <p className="mt-1 font-semibold">{ctx.trip.name}</p>
          <p className="text-sm text-muted-foreground">
            {ctx.trip.destination}
          </p>
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">Departure</span>{" "}
            {formatDate(ctx.trip.departureDate)}
          </p>
        </div>
      </div>

      <Separator className="my-6" />

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Description</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="px-4 py-3">
                Travel payment — {ctx.trip.name}
                {ctx.note ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {ctx.note}
                  </span>
                ) : null}
                <span className="mt-1 block text-xs text-muted-foreground">
                  Method: {ctx.method}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {formatZAR(ctx.amount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-3 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">This payment</p>
          <p className="text-lg font-bold tabular-nums">{formatZAR(ctx.amount)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total paid to date (after)</p>
          <p className="text-lg font-semibold tabular-nums text-emerald-900 dark:text-emerald-200">
            {formatZAR(ctx.totalPaidAfter)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Remaining balance (after)</p>
          <p className="text-lg font-bold tabular-nums">
            {formatZAR(ctx.balanceAfter)}
          </p>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Nendila Travel Explorers — payment receipt. Each transaction keeps its own
        invoice number for audit and client records. Non-production demo data.
      </p>
    </div>
  );
}
