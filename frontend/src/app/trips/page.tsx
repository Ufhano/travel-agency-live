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
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { TripStatusBadge } from "@/components/trip-status-badge";
import { TripsCreatePanel } from "@/components/trips-create-panel";
import { InlineTripDateCell } from "@/components/inline-trip-date-cell";
import { createCompute } from "@backend/compute";
import { loadAppDataForPage } from "@/lib/page-data";
import { formatZAR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const { data, dbError } = await loadAppDataForPage();
  const { aggregateTrip, displayTripStatus } = createCompute(data);

  const tripRows = [...data.trips]
    .sort((a, b) => a.departureDate.localeCompare(b.departureDate))
    .map((trip) => ({
      trip,
      agg: aggregateTrip(trip.id)!,
    }));

  return (
    <div className="space-y-6">
      {dbError ? <DbConnectionBanner message={dbError} /> : null}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trips</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Create departures manually, then assign travellers from Clients or
          Import. Each trip tracks capacity, payments, and planning status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create a trip</CardTitle>
          <CardDescription>
            Add a new departure with a name, destination, and optional date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TripsCreatePanel />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All departures</CardTitle>
          <CardDescription>
            {tripRows.length === 0
              ? "No trips yet — create one above to get started."
              : `${tripRows.length} departure${tripRows.length === 1 ? "" : "s"} in your account.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trip</TableHead>
                <TableHead className="hidden md:table-cell">Departs</TableHead>
                <TableHead className="hidden sm:table-cell text-right">
                  Travellers
                </TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tripRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No trips yet. Use the form above to create your first
                    departure.
                  </TableCell>
                </TableRow>
              ) : (
                tripRows.map(({ trip, agg }) => {
                  const status = displayTripStatus(trip, agg);
                  return (
                    <TableRow key={trip.id}>
                      <TableCell>
                        <Link
                          href={`/trips/${trip.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {trip.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {trip.destination}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap text-muted-foreground">
                        <InlineTripDateCell
                          tripId={trip.id}
                          departureDate={trip.departureDate}
                        />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                        {agg.confirmedCount} / {trip.capacity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatZAR(agg.outstanding)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <TripStatusBadge status={status} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
