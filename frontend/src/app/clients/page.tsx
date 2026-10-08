import Link from "next/link";

import { Split, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

import { AddClientDialog } from "@/components/add-client-dialog";

import {
  ClientsDirectorySection,
  type ClientDirectoryRow,
} from "@/components/clients-directory-section";

import { DbConnectionBanner } from "@/components/db-connection-banner";

import { createCompute } from "@backend/compute";

import { getSql } from "@backend/db";

import {
  listTenantGroupSplitPassengers,
  passengerBalance,
} from "@backend/group-booking";

import { loadAppDataForPage } from "@/lib/page-data";

import type { Trip } from "@backend/types";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { data, dbError, session } = await loadAppDataForPage();

  const { balanceForClient, getTrip, totalPaidForClient } = createCompute(data);

  const sql = getSql();
  const groupSplitPassengers =
    sql != null
      ? await listTenantGroupSplitPassengers(sql, session.tenantId)
      : [];

  const tripById = new Map(data.trips.map((t) => [t.id, t]));

  const rows: ClientDirectoryRow[] = data.clients.flatMap((c) => {
    const trip = getTrip(c.tripId);
    if (!trip) return [];
    return [
      {
        kind: "client" as const,
        client: c,
        trip,
        paid: totalPaidForClient(c.id),
        balance: balanceForClient(c),
      },
    ];
  });

  for (const p of groupSplitPassengers) {
    const trip: Trip =
      tripById.get(p.tripId) ??
      ({
        id: p.tripId,
        name: p.tripName,
        destination: p.tripDestination,
        departureDate: p.departureDate,
        returnDate: null,
        capacity: 0,
        status: "Open",
        accommodationNote: "",
        packagePrice: null,
      } satisfies Trip);

    rows.push({
      kind: "group-split",
      passengerId: p.id,
      groupBookingId: p.groupBookingId,
      referenceNumber: p.referenceNumber,
      passengerName: p.passengerName,
      trip,
      paid: p.amountPaid,
      balance: passengerBalance(p),
      packagePrice: p.packagePrice,
    });
  }

  const tripOptions = data.trips.map((t) => ({
    id: t.id,
    name: t.name,
    destination: t.destination,
    departureDate: t.departureDate,
    packagePrice: t.packagePrice,
  }));

  const byDestination = new Map<string, ClientDirectoryRow[]>();

  for (const row of rows) {
    const key = row.trip.destination.trim() || "Other destinations";
    const list = byDestination.get(key) ?? [];
    list.push(row);
    byDestination.set(key, list);
  }

  const destinationGroups = [...byDestination.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([destination, groupRows]) => ({
      destination,
      rows: groupRows.sort((a, b) => {
        const nameA =
          a.kind === "client" ? a.client.fullName : a.passengerName;
        const nameB =
          b.kind === "client" ? b.client.fullName : b.passengerName;
        return nameA.localeCompare(nameB);
      }),
    }));

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
            invoice trail. Group-split passengers appear with a GS badge.
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

      <ClientsDirectorySection
        destinationGroups={destinationGroups}
        trips={data.trips}
      />
    </div>
  );
}
