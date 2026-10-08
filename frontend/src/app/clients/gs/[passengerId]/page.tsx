import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, Paperclip } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientFullyPaidBadge } from "@/components/client-fully-paid-badge";
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { DeleteGroupSplitPassengerButton } from "@/components/delete-group-split-passenger-button";
import { DeleteGroupSplitPaymentButton } from "@/components/delete-group-split-payment-button";
import { GroupSplitBadge } from "@/components/group-split-badge";
import { GroupSplitInlineName } from "@/components/group-split-inline-name";
import { GroupSplitInlineContactField } from "@/components/group-split-inline-contact-field";
import { GroupSplitInvoicePicker } from "@/components/group-split-invoice-picker";
import { GroupSplitPassengerPaymentCard } from "@/components/group-split-passenger-payment-card";
import {
  getTenantGroupSplitPassengerById,
  listGroupBookingFollowUpPayments,
  passengerBalance,
} from "@backend/group-booking";
import { getSql } from "@backend/db";
import { loadAppDataForPage } from "@/lib/page-data";
import { formatDate, formatZAR } from "@/lib/utils";

export default async function GroupSplitPassengerPage({
  params,
}: {
  params: Promise<{ passengerId: string }>;
}) {
  const { passengerId } = await params;
  const { dbError, session } = await loadAppDataForPage();
  const sql = getSql();

  if (!sql) {
    return (
      <div className="space-y-6">
        {dbError ? <DbConnectionBanner message={dbError} /> : null}
        <p className="text-sm text-muted-foreground">
          Database is unavailable. Try again shortly.
        </p>
      </div>
    );
  }

  const passenger = await getTenantGroupSplitPassengerById(
    sql,
    session.tenantId,
    passengerId,
  );
  if (!passenger) notFound();

  const balance = passengerBalance(passenger);
  const followUps = (
    await listGroupBookingFollowUpPayments(
      sql,
      session.tenantId,
      passenger.groupBookingId,
    )
  ).filter((p) => p.passengerId === passenger.id);

  const receiptRows: {
    key: string;
    paymentId?: string;
    invoiceNumber: string;
    paidAt: string;
    note: string;
    amount: number;
    paidAfter: number;
    balanceAfter: number;
    invoiceHref: string;
    proofHref?: string;
    proofLabel?: string;
  }[] = [];

  let runningPaid = 0;
  if (passenger.allocatedAmount > 0) {
    runningPaid = passenger.allocatedAmount;
    receiptRows.push({
      key: "initial",
      invoiceNumber: `GS-${passenger.id.slice(-8).toUpperCase()}-01`,
      paidAt: passenger.paidAt,
      note: `Initial group payment (${passenger.referenceNumber})`,
      amount: passenger.allocatedAmount,
      paidAfter: runningPaid,
      balanceAfter: Math.max(0, passenger.packagePrice - runningPaid),
      invoiceHref: `/clients/gs/${passenger.id}/invoice?type=receipt&paymentId=initial`,
      proofHref: `/api/group-bookings/${passenger.groupBookingId}/proof`,
      proofLabel: "Group proof",
    });
  }

  for (const payment of followUps) {
    runningPaid += payment.amount;
    receiptRows.push({
      key: payment.id,
      paymentId: payment.id,
      invoiceNumber: `GS-${payment.id.slice(-8).toUpperCase()}`,
      paidAt: payment.paidAt,
      note: payment.note || "Additional payment",
      amount: payment.amount,
      paidAfter: runningPaid,
      balanceAfter: Math.max(0, passenger.packagePrice - runningPaid),
      invoiceHref: `/clients/gs/${passenger.id}/invoice?type=receipt&paymentId=${payment.id}`,
      proofHref: payment.proofFileName
        ? `/api/group-bookings/${passenger.groupBookingId}/passengers/${passenger.id}/payments/${payment.id}/proof`
        : undefined,
      proofLabel: payment.proofFileName,
    });
  }

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
          <h1 className="inline-flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            <GroupSplitInlineName
              passengerId={passenger.id}
              name={passenger.passengerName}
            />
            <GroupSplitBadge />
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <GroupSplitInlineContactField
              passengerId={passenger.id}
              field="email"
              value={passenger.passengerEmail}
            />
            <GroupSplitInlineContactField
              passengerId={passenger.id}
              field="phone"
              value={passenger.passengerPhone}
            />
            <GroupSplitInlineContactField
              passengerId={passenger.id}
              field="idNumber"
              value={passenger.passengerIdNumber ?? ""}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {passenger.tripName} · {passenger.tripDestination}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <ClientFullyPaidBadge balance={balance} />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/group-bookings/${passenger.groupBookingId}`}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                {passenger.referenceNumber}
              </Link>
            </Button>
            <DeleteGroupSplitPassengerButton
              passengerId={passenger.id}
              passengerName={passenger.passengerName}
              variant="outline"
              size="sm"
              label="Delete traveller"
            />
          </div>
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
                {formatZAR(passenger.packagePrice)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total paid</p>
              <p className="text-lg font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                {formatZAR(passenger.amountPaid)}
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

      <GroupSplitPassengerPaymentCard
        groupBookingId={passenger.groupBookingId}
        passengerId={passenger.id}
        passengerName={passenger.passengerName}
        balance={balance}
      />

      <GroupSplitInvoicePicker
        passengerId={passenger.id}
        passengerName={passenger.passengerName}
        packagePrice={passenger.packagePrice}
        totalPaid={passenger.amountPaid}
        balance={balance}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Receipts & payments</CardTitle>
          <CardDescription>
            Open the document icon on any row to view or print that payment
            invoice — same as regular clients.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden md:table-cell text-right">
                  Paid after
                </TableHead>
                <TableHead className="hidden md:table-cell text-right">
                  Balance after
                </TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {receiptRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    No payments recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                receiptRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-mono text-xs font-medium">
                      {row.invoiceNumber}
                      <div className="font-sans text-[11px] text-muted-foreground sm:hidden">
                        {formatDate(row.paidAt)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {formatDate(row.paidAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.note}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatZAR(row.amount)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {formatZAR(row.paidAfter)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {formatZAR(row.balanceAfter)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        {row.proofHref ? (
                          <Button variant="ghost" size="sm" asChild>
                            <a
                              href={row.proofHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={row.proofLabel ?? "View proof"}
                            >
                              <Paperclip className="h-4 w-4" />
                              <span className="sr-only">View proof</span>
                            </a>
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={row.invoiceHref} title="Open invoice">
                            <FileText className="h-4 w-4" />
                            <span className="sr-only">Open invoice</span>
                          </Link>
                        </Button>
                        {row.paymentId ? (
                          <DeleteGroupSplitPaymentButton
                            groupBookingId={passenger.groupBookingId}
                            passengerId={passenger.id}
                            paymentId={row.paymentId}
                            invoiceNumber={row.invoiceNumber}
                            passengerName={passenger.passengerName}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
