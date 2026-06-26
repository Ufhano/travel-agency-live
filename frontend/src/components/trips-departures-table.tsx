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
import { InlineTripDateCell } from "@/components/inline-trip-date-cell";
import { TableSearchInput } from "@/components/table-search-input";
import { TripStatusBadge } from "@/components/trip-status-badge";
import { DeleteTripButton } from "@/components/delete-trip-button";
import { matchesSearch } from "@/lib/search-utils";
import { formatDate, formatZAR } from "@/lib/utils";

export type TripDepartureRow = {
  tripId: string;
  tripName: string;
  destination: string;
  departureDate: string;
  confirmedCount: number;
  capacity: number;
  outstanding: number;
  status: string;
};

type Props = {
  rows: TripDepartureRow[];
};

export function TripsDeparturesTable({ rows }: Props) {
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
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">All departures</CardTitle>
            <CardDescription>
              {rows.length === 0
                ? "No trips yet — create one above to get started."
                : `${rows.length} departure${rows.length === 1 ? "" : "s"} in your account.`}
            </CardDescription>
          </div>
          {rows.length > 0 ? (
            <TableSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search trips…"
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:px-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trip</TableHead>
              <TableHead className="hidden md:table-cell">Departs</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Travellers</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="hidden lg:table-cell">Status</TableHead>
              <TableHead className="w-[56px] text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No trips yet. Use the form above to create your first departure.
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No trips match your search.
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
                    <InlineTripDateCell
                      tripId={row.tripId}
                      departureDate={row.departureDate}
                    />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                    {row.confirmedCount} / {row.capacity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatZAR(row.outstanding)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <TripStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteTripButton
                      tripId={row.tripId}
                      tripName={row.tripName}
                      travellerCount={row.confirmedCount}
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
