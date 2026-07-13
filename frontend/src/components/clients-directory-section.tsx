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
import { ClientFullyPaidBadge } from "@/components/client-fully-paid-badge";
import { ClientRowActions } from "@/components/client-row-actions";
import { GroupSplitBadge } from "@/components/group-split-badge";
import { InlineTripNameCell } from "@/components/inline-trip-name-cell";
import { DeleteClientsBulkButton } from "@/components/delete-clients-bulk-button";
import { TableSearchInput } from "@/components/table-search-input";
import { matchesSearch } from "@/lib/search-utils";
import { formatZAR } from "@/lib/utils";
import type { Client, Trip } from "@backend/types";

export type ClientDirectoryRow =
  | {
      kind: "client";
      client: Client;
      trip: Trip;
      paid: number;
      balance: number;
    }
  | {
      kind: "group-split";
      passengerId: string;
      groupBookingId: string;
      referenceNumber: string;
      passengerName: string;
      trip: Trip;
      paid: number;
      balance: number;
      packagePrice: number;
    };

type DestinationGroup = {
  destination: string;
  rows: ClientDirectoryRow[];
};

type Props = {
  destinationGroups: DestinationGroup[];
  trips: Trip[];
};

export function ClientsDirectorySection({ destinationGroups, trips }: Props) {
  const [search, setSearch] = React.useState("");

  const filteredGroups = destinationGroups
    .map(({ destination, rows }) => ({
      destination,
      rows: rows.filter((row) => {
        if (row.kind === "client") {
          return matchesSearch(
            search,
            row.client.fullName,
            row.trip.name,
            row.trip.destination,
            destination,
          );
        }
        return matchesSearch(
          search,
          row.passengerName,
          row.trip.name,
          row.trip.destination,
          row.referenceNumber,
          destination,
          "group split",
          "gs",
        );
      }),
    }))
    .filter((group) => group.rows.length > 0);

  const hasAnyClients = destinationGroups.some((g) => g.rows.length > 0);

  return (
    <div className="space-y-6">
      {hasAnyClients ? (
        <TableSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search clients, trips, or destinations…"
          className="sm:max-w-sm"
        />
      ) : null}

      {!hasAnyClients ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">No travellers yet</CardTitle>
            <CardDescription>
              Add a client or import from a spreadsheet to get started.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">No matches</CardTitle>
            <CardDescription>No travellers match your search.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        filteredGroups.map(({ destination, rows }) => {
          const regularCount = rows.filter((r) => r.kind === "client").length;
          return (
            <Card key={destination}>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Destination
                  </p>
                  <CardTitle className="text-lg">{destination}</CardTitle>
                  <CardDescription>
                    {rows.length} traveller
                    {rows.length === 1 ? "" : "s"}
                  </CardDescription>
                </div>
                {regularCount > 0 ? (
                  <DeleteClientsBulkButton
                    mode={{
                      kind: "destination",
                      destination,
                      label: destination,
                      count: regularCount,
                    }}
                  />
                ) : null}
              </CardHeader>
              <CardContent className="p-0 sm:px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead className="hidden md:table-cell">Trip</TableHead>
                      <TableHead className="text-right leading-snug lg:whitespace-normal max-w-[8rem]">
                        Total amount to be paid
                      </TableHead>
                      <TableHead className="text-right">Amount paid</TableHead>
                      <TableHead className="text-right leading-snug lg:whitespace-normal max-w-[8rem]">
                        Outstanding amount
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[72px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      if (row.kind === "group-split") {
                        return (
                          <TableRow key={`gs-${row.passengerId}`}>
                            <TableCell>
                              <Link
                                href={`/clients/gs/${row.passengerId}`}
                                className="inline-flex items-center font-medium text-primary hover:underline"
                              >
                                {row.passengerName}
                                <GroupSplitBadge />
                              </Link>
                              <div className="text-xs text-muted-foreground">
                                {row.referenceNumber}
                              </div>
                              <div className="text-xs text-muted-foreground md:hidden">
                                <InlineTripNameCell
                                  tripId={row.trip.id}
                                  initialName={row.trip.name}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <InlineTripNameCell
                                tripId={row.trip.id}
                                initialName={row.trip.name}
                              />
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatZAR(row.packagePrice)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-emerald-800 dark:text-emerald-300">
                              {formatZAR(row.paid)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatZAR(row.balance)}
                            </TableCell>
                            <TableCell>
                              <ClientFullyPaidBadge balance={row.balance} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Link
                                href={`/clients/gs/${row.passengerId}`}
                                className="text-xs text-primary hover:underline"
                              >
                                Open
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      }

                      const { client, trip, paid, balance } = row;
                      return (
                        <TableRow key={client.id}>
                          <TableCell>
                            <Link
                              href={`/clients/${client.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {client.fullName}
                            </Link>
                            <div className="text-xs text-muted-foreground md:hidden">
                              <InlineTripNameCell
                                tripId={trip.id}
                                initialName={trip.name}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <InlineTripNameCell
                              tripId={trip.id}
                              initialName={trip.name}
                            />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatZAR(client.packagePrice)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-800 dark:text-emerald-300">
                            {formatZAR(paid)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatZAR(balance)}
                          </TableCell>
                          <TableCell>
                            <ClientFullyPaidBadge balance={balance} />
                          </TableCell>
                          <TableCell className="text-right">
                            <ClientRowActions client={client} trips={trips} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
