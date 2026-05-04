import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createCompute } from "@backend/compute";
import { loadAppData } from "@backend/load-app-data";
import { formatDate, formatZAR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const data = await loadAppData();
  const { allPaymentsEnriched } = createCompute(data);
  const rows = allPaymentsEnriched();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Invoice ledger
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every payment is a permanent row: unique invoice number, running balance,
          and full audit trail — no overwriting a single template.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All receipts</CardTitle>
          <CardDescription>
            Newest first. Open any line for a print-ready invoice for that payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden lg:table-cell">Trip</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden md:table-cell text-right">
                  Paid after
                </TableHead>
                <TableHead className="hidden md:table-cell text-right">
                  Balance after
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/invoices/${r.id}`}
                      className="font-mono text-xs font-semibold text-primary hover:underline"
                    >
                      {r.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell whitespace-nowrap text-muted-foreground">
                    {formatDate(r.paidAt)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/clients/${r.client.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.client.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Link
                      href={`/trips/${r.trip.id}`}
                      className="text-primary hover:underline"
                    >
                      {r.trip.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatZAR(r.amount)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums">
                    {formatZAR(r.totalPaidAfter)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums">
                    {formatZAR(r.balanceAfter)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
