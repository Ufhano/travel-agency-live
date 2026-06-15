import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ClientDetailToolbar } from "@/components/client-detail-toolbar";
import { ClientInvoicePicker } from "@/components/client-invoice-picker";
import { DeleteInvoiceButton } from "@/components/delete-invoice-button";
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { createCompute } from "@backend/compute";
import {
  collectClientMonthlyInstallments,
  paymentMonthLabel,
} from "@backend/payment-schedule";
import { loadAppDataForPage } from "@/lib/page-data";
import { formatDate, formatDateTime, formatZAR } from "@/lib/utils";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { data: app, dbError } = await loadAppDataForPage();
  const {
    balanceForClient,
    enrichPayment,
    getClient,
    getTrip,
    paymentsForClient,
    totalPaidForClient,
  } = createCompute(app);
  const client = getClient(clientId);
  if (!client) notFound();
  const trip = getTrip(client.tripId)!;
  const paid = totalPaidForClient(client.id);
  const balance = balanceForClient(client);
  const history = paymentsForClient(client.id);
  const monthlyInstallments = collectClientMonthlyInstallments(history);
  const instalmentsTotal = monthlyInstallments.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-8">
      {dbError ? <DbConnectionBanner message={dbError} /> : null}
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All clients
      </Link>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {client.fullName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {client.phone} · {client.email}
          </p>
          <ClientDetailToolbar
            client={client}
            trip={trip}
            trips={app.trips}
            balance={balance}
          />
        </div>

        <Card className="w-full lg:max-w-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Package & balance
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-1">
            <div>
              <p className="text-muted-foreground">Package price</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatZAR(client.packagePrice)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total paid</p>
              <p className="text-lg font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                {formatZAR(paid)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Remaining</p>
              <p className="text-lg font-bold tabular-nums">
                {formatZAR(balance)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ClientInvoicePicker
        clientId={client.id}
        clientName={client.fullName}
        packagePrice={client.packagePrice}
        totalPaid={paid}
        balance={balance}
      />

      {monthlyInstallments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">When they paid (by month)</CardTitle>
            <CardDescription>
              Each row is an instalment month from the group payment tracker.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyInstallments.map((inst) => (
                  <TableRow key={`${inst.month}-${inst.amount}-${inst.paidAt ?? ""}`}>
                    <TableCell className="font-medium">{inst.month}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {inst.paidAt ? formatDate(inst.paidAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatZAR(inst.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-medium">
                  <TableCell colSpan={2}>Total instalments</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatZAR(instalmentsTotal)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : history.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly payments not on file</CardTitle>
            <CardDescription>
              This traveller was saved before the monthly breakdown was recorded.
              Re-import the spreadsheet on the Import page and save this group again
              to see which months they paid and how much.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Receipts & payments</CardTitle>
          <CardDescription>
            Each payment creates a unique invoice record — new receipts append;
            older ones stay on file.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="hidden sm:table-cell">Date recorded</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden md:table-cell text-right">
                  Paid after
                </TableHead>
                <TableHead className="hidden md:table-cell text-right">
                  Balance after
                </TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((p) => {
                const ctx = enrichPayment(p)!;
                const month = paymentMonthLabel(p);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {month ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium">
                      {p.invoiceNumber}
                      <div className="font-sans text-[11px] text-muted-foreground sm:hidden">
                        {formatDateTime(p.paidAt)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell whitespace-nowrap text-muted-foreground">
                      {formatDateTime(p.paidAt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatZAR(p.amount)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      {formatZAR(ctx.totalPaidAfter)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      {formatZAR(ctx.balanceAfter)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/invoices/${p.id}`}>
                            <FileText className="h-4 w-4" />
                            <span className="sr-only">Open invoice</span>
                          </Link>
                        </Button>
                        <DeleteInvoiceButton
                          paymentId={p.id}
                          invoiceNumber={p.invoiceNumber}
                          clientName={client.fullName}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
