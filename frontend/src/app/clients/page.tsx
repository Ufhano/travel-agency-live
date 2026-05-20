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
import { PaymentStatusBadge } from "@/components/payment-status-badge";
import { AddClientDialog } from "@/components/add-client-dialog";
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { DeleteClientButton } from "@/components/delete-client-button";
import { DeleteClientsBulkButton } from "@/components/delete-clients-bulk-button";
import { createCompute } from "@backend/compute";
import { loadAppData } from "@backend/load-app-data";
import { formatZAR } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ClientRow = {
  client: { id: string; fullName: string; packagePrice: number };
  trip: { id: string; name: string; destination: string };
  paid: number;
  balance: number;
  status: ReturnType<ReturnType<typeof createCompute>["clientPaymentStatus"]>;
};

export default async function ClientsPage() {
  const { data, dbError } = await loadAppData();
  const {
    balanceForClient,
    clientPaymentStatus,
    getTrip,
    totalPaidForClient,
  } = createCompute(data);
  const rows: ClientRow[] = data.clients.flatMap((c) => {
    const trip = getTrip(c.tripId);
    if (!trip) return [];
    return [
      {
        client: c,
        trip,
        paid: totalPaidForClient(c.id),
        balance: balanceForClient(c),
        status: clientPaymentStatus(c),
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
        <AddClientDialog trips={tripOptions} />
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
                  {groupRows.map(({ client, trip, paid, balance, status }) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {client.fullName}
                        </Link>
                        <div className="text-xs text-muted-foreground md:hidden">
                          {trip.name}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Link
                          href={`/trips/${trip.id}`}
                          className="text-primary hover:underline"
                        >
                          {trip.name}
                        </Link>
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
                        <PaymentStatusBadge status={status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DeleteClientButton
                          clientId={client.id}
                          clientName={client.fullName}
                          size="icon"
                          variant="ghost"
                        />
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
