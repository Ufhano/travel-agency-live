import Link from "next/link";

import { Split, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

import { AddClientDialog } from "@/components/add-client-dialog";

import { ClientsDirectorySection } from "@/components/clients-directory-section";

import { DbConnectionBanner } from "@/components/db-connection-banner";

import { createCompute } from "@backend/compute";

import { loadAppDataForPage } from "@/lib/page-data";

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

  const destinationGroups = [...byDestination.entries()]

    .sort((a, b) => a[0].localeCompare(b[0]))

    .map(([destination, groupRows]) => ({ destination, rows: groupRows }));



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



      <ClientsDirectorySection destinationGroups={destinationGroups} trips={data.trips} />

    </div>

  );

}


