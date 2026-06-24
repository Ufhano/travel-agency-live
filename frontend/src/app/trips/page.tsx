import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { TripsCreatePanel } from "@/components/trips-create-panel";
import { TripsDeparturesTable } from "@/components/trips-departures-table";
import { createCompute } from "@backend/compute";
import { loadAppDataForPage } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const { data, dbError } = await loadAppDataForPage();
  const { aggregateTrip, displayTripStatus } = createCompute(data);

  const tripRows = [...data.trips]
    .sort((a, b) => a.departureDate.localeCompare(b.departureDate))
    .map((trip) => {
      const agg = aggregateTrip(trip.id)!;
      return {
        tripId: trip.id,
        tripName: trip.name,
        destination: trip.destination,
        departureDate: trip.departureDate,
        confirmedCount: agg.confirmedCount,
        capacity: trip.capacity,
        outstanding: agg.outstanding,
        status: displayTripStatus(trip, agg),
      };
    });

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

      <TripsDeparturesTable rows={tripRows} />
    </div>
  );
}
