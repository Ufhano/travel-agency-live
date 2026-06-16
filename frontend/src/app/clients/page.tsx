import Link from "next/link";
import { Split, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { AddClientDialog } from "@/components/add-client-dialog";
import { ClientRowActions } from "@/components/client-row-actions";
import { InlineTripNameCell } from "@/components/inline-trip-name-cell";
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { DeleteClientsBulkButton } from "@/components/delete-clients-bulk-button";
import { createCompute } from "@backend/compute";
import { loadAppDataForPage } from "@/lib/page-data";
import { formatZAR } from "@/lib/utils";
import type { Client, Trip } from "@backend/types";

export const dynamic = "force-dynamic";

type ClientRow = {
  client: Client;
  trip: Trip;
  paid: number;
  balance: number;
};

export default async function ClientsPage() {
  const { data, dbError } = await loadAppDataForPage();
  const { balanceForClient, getTrip, totalPaidForClient } = createCompute(data);
  const rows: ClientRow[] = data.clients.flatMap((c) => {
    const trip = getTrip(c.tripId);
    if (!trip) return [];
    return [
      {
        client: c,
        trip,
        paid: totalPaidForClient(c.id),
        balance: balanceForClient(c),
      },
    ];
  });

  const tripOptions = data.trips.map((t) => ({
    id: t.id,
    name: t.name,
    destination: t.destination,
    departureDate: t.departureDate,
  }));

  const byDestination = new Map<string, ClientRow[]>();
  for (const row of rows) {
    const key = row.trip.destination.trim() || "Other destinations";
    const list = byDestination.get(key) ?? [];
    list.push(row);
    byDestination.set(key, list);
  }
  const destinationGroups = [...byDestination.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <div className="space-y-6">
      {dbError ? <DbConnectionBanner message={dbError} /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Traveller directory
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each booking ties to a departure, live balance, and full payment /
            invoice trail. Delete one traveller or an entire destination group.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link href="/payments/allocate">
              <Split className="h-4 w-4" />
              multi-trip
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link href="/group-bookings/new">
              <Users className="h-4 w-4" />
              Group fare split
            </Link>
          </Button>
          <AddClientDialog trips={tripOptions} />
        </div>
      </div>

      {destinationGroups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">No travellers yet</CardTitle>
            <CardDescription>
              Add a client or import from a spreadsheet to get started.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        destinationGroups.map(([destination, groupRows]) => (
          <Card key={destination}>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Destination
                </p>
                <CardTitle className="text-lg">{destination}</CardTitle>
                <CardDescription>
                  {groupRows.length} traveller
                  {groupRows.length === 1 ? "" : "s"}
                </CardDescription>
              </div>
              <DeleteClientsBulkButton
                mode={{
                  kind: "destination",
                  destination,
                  label: destination,
                  count: groupRows.length,
                }}
              />
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
                  {groupRows.map(({ client, trip, paid, balance }) => (
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
                        <ClientRowActions client={client} trips={data.trips} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
