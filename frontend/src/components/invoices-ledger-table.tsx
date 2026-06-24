"use client";

import * as React from "react";
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
import { DeleteInvoiceButton } from "@/components/delete-invoice-button";
import { TableSearchInput } from "@/components/table-search-input";
import { matchesSearch } from "@/lib/search-utils";
import { formatDate, formatZAR } from "@/lib/utils";

export type InvoiceLedgerRow = {
  id: string;
  invoiceNumber: string;
  paidAt: string;
  clientId: string;
  clientName: string;
  tripId: string;
  tripName: string;
  amount: number;
  totalPaidAfter: number;
  balanceAfter: number;
};

type Props = {
  rows: InvoiceLedgerRow[];
};

export function InvoicesLedgerTable({ rows }: Props) {
  const [search, setSearch] = React.useState("");

  const filtered = rows.filter((row) =>
    matchesSearch(
      search,
      row.invoiceNumber,
      row.clientName,
      row.tripName,
      formatDate(row.paidAt),
    ),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">All receipts</CardTitle>
            <CardDescription>
              Newest first. Open any line for a print-ready invoice for that payment.
            </CardDescription>
          </div>
          <TableSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search invoices…"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:px-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="hidden lg:table-cell">Trip</TableHead>
              <TableHead className="text-right">Amount paid</TableHead>
              <TableHead className="hidden md:table-cell text-right">Paid after</TableHead>
              <TableHead className="hidden md:table-cell text-right">Balance after</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No invoices yet.
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No invoices match your search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/invoices/${row.id}`}
                      className="font-mono text-xs font-semibold text-primary hover:underline"
                    >
                      {row.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell whitespace-nowrap text-muted-foreground">
                    {formatDate(row.paidAt)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/clients/${row.clientId}`}
                      className="font-medium hover:underline"
                    >
                      {row.clientName}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Link
                      href={`/trips/${row.tripId}`}
                      className="text-primary hover:underline"
                    >
                      {row.tripName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatZAR(row.amount)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums">
                    {formatZAR(row.totalPaidAfter)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums">
                    {formatZAR(row.balanceAfter)}
                  </TableCell>
                  <TableCell>
                    <DeleteInvoiceButton
                      paymentId={row.id}
                      invoiceNumber={row.invoiceNumber}
                      clientName={row.clientName}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
