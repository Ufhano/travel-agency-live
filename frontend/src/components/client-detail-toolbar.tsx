"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClientFullyPaidBadge } from "@/components/client-fully-paid-badge";
import { DeleteClientButton } from "@/components/delete-client-button";
import { EditClientDialog } from "@/components/edit-client-dialog";
import { formatTripDates } from "@/lib/utils";
import type { Client, Trip } from "@backend/types";

export function ClientDetailToolbar({
  client,
  trip,
  trips,
  balance,
}: {
  client: Client;
  trip: Trip;
  trips: Trip[];
  balance: number;
}) {
  const [editOpen, setEditOpen] = React.useState(false);

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ClientFullyPaidBadge balance={balance} />
        <Button variant="outline" size="sm" asChild>
          <Link href={`/trips/${trip.id}`}>View trip</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setEditOpen(true)}
        >
          Edit traveller
        </Button>
        <DeleteClientButton
          clientId={client.id}
          clientName={client.fullName}
          redirectTo="/clients"
          variant="destructive"
          size="sm"
          label="Delete traveller"
        />
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Current departure</CardTitle>
          <CardDescription>
            This traveller is booked on the trip below. You can move them to a
            different departure or edit other details using the same form.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-foreground">{trip.name}</p>
            <p className="text-muted-foreground">{trip.destination}</p>
            <p className="text-muted-foreground">
              Dates{" "}
              <span className="font-medium text-foreground">
                {formatTripDates(trip.departureDate, trip.returnDate)}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/trips/${trip.id}`}>Open trip detail</Link>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              Change departure
            </Button>
          </div>
        </CardContent>
      </Card>

      <EditClientDialog
        client={client}
        trips={trips}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
