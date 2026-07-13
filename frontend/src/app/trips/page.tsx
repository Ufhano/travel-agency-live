import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { TripsCreatePanel } from "@/components/trips-create-panel";
import { TripsDeparturesTable } from "@/components/trips-departures-table";
import { createCompute } from "@backend/compute";
import { getSql } from "@backend/db";
import { summarizeGroupSplitByTrip } from "@backend/group-booking";
import { loadAppDataForPage } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const { data, dbError, session } = await loadAppDataForPage();
  const { aggregateTrip, displayTripStatus } = createCompute(data);

  const sql = getSql();
  const groupSplitByTrip =
    sql != null
      ? await summarizeGroupSplitByTrip(sql, session.tenantId)
      : {};

  const tripRows = [...data.trips]
    .sort((a, b) => a.departureDate.localeCompare(b.departureDate))
    .map((trip) => {
      const agg = aggregateTrip(trip.id)!;
      const gs = groupSplitByTrip[trip.id];
      const confirmedCount = agg.confirmedCount + (gs?.passengerCount ?? 0);
      const outstanding = agg.outstanding + (gs?.outstanding ?? 0);
      const mergedAgg = {
        ...agg,
        confirmedCount,
        outstanding,
        totalExpectedRevenue:
          agg.totalExpectedRevenue + (gs?.totalExpected ?? 0),
        totalPaid: agg.totalPaid + (gs?.totalPaid ?? 0),
        fillRatio: trip.capacity > 0 ? confirmedCount / trip.capacity : 0,
      };
      return {
        tripId: trip.id,
        tripName: trip.name,
        destination: trip.destination,
        departureDate: trip.departureDate,
        packagePrice: trip.packagePrice,
        confirmedCount,
        capacity: trip.capacity,
        outstanding,
        status: displayTripStatus(trip, mergedAgg),
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
            Add a new departure with a name, destination, optional date, and
            package price.
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
