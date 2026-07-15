"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSearchInput } from "@/components/table-search-input";
import { TripStatusBadge } from "@/components/trip-status-badge";
import { matchesSearch } from "@/lib/search-utils";
import { formatDate, formatZAR } from "@/lib/utils";

export type DashboardDepartureRow = {
  tripId: string;
  tripName: string;
  destination: string;
  departureDate: string;
  totalExpectedRevenue: number;
  totalPaid: number;
  outstanding: number;
  status: string;
};

type Props = {
  rows: DashboardDepartureRow[];
};

export function DashboardDeparturesSection({ rows }: Props) {
  const [search, setSearch] = React.useState("");

  const filtered = rows.filter((row) =>
    matchesSearch(
      search,
      row.tripName,
      row.destination,
      formatDate(row.departureDate),
      row.status,
    ),
  );

  return (
    <div id="departures" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Departures at a glance</h2>
        <TableSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search departures…"
        />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trip</TableHead>
                <TableHead className="hidden md:table-cell whitespace-nowrap">
                  Departs
                </TableHead>
                <TableHead className="text-right whitespace-normal min-w-[7.5rem] max-w-[10rem] align-bottom leading-tight">
                  Total amount
                  <br />
                  <span className="font-normal">to be paid</span>
                </TableHead>
                <TableHead className="text-right whitespace-normal min-w-[6rem] max-w-[9rem] leading-tight">
                  Amount
                  <br />
                  <span className="font-normal">paid</span>
                </TableHead>
                <TableHead className="text-right whitespace-normal min-w-[6rem] max-w-[9rem] leading-tight">
                  Outstanding
                  <br />
                  <span className="font-normal">amount</span>
                </TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No departures with saved travellers yet. Import a spreadsheet,
                    add clients, or create a group split on a trip to see them here.
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No departures match your search.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.tripId}>
                    <TableCell>
                      <Link
                        href={`/trips/${row.tripId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.tripName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{row.destination}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell whitespace-nowrap text-muted-foreground">
                      {formatDate(row.departureDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatZAR(row.totalExpectedRevenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-800 dark:text-emerald-300">
                      {formatZAR(row.totalPaid)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatZAR(row.outstanding)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <TripStatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filtered.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => (
            <Card key={row.tripId} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{row.tripName}</CardTitle>
                    <CardDescription>{row.destination}</CardDescription>
                  </div>
                  <TripStatusBadge status={row.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Departure</span>
                  <span className="text-foreground">{formatDate(row.departureDate)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Total amount to be paid</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatZAR(row.totalExpectedRevenue)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Amount paid</span>
                  <span className="font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                    {formatZAR(row.totalPaid)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Outstanding amount</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatZAR(row.outstanding)}
                  </span>
                </div>
                <Link
                  href={`/trips/${row.tripId}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  View departure
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
