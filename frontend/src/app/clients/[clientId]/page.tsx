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
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { createCompute } from "@backend/compute";
import { loadAppData } from "@backend/load-app-data";
import { formatDateTime, formatZAR } from "@/lib/utils";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { data: app, dbError } = await loadAppData();
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
                <TableHead>Invoice</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="text-right">This payment</TableHead>
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
                return (
                  <TableRow key={p.id}>
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
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/invoices/${p.id}`}>
                          <FileText className="h-4 w-4" />
                          <span className="sr-only">Open invoice</span>
                        </Link>
                      </Button>
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
