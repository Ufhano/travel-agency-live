import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BedDouble,
  Bus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientFullyPaidBadge } from "@/components/client-fully-paid-badge";
import { TripStatusBadge } from "@/components/trip-status-badge";
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { DeleteClientButton } from "@/components/delete-client-button";
import { DeleteClientsBulkButton } from "@/components/delete-clients-bulk-button";
import { AddClientDialog } from "@/components/add-client-dialog";
import { InlineTripDateCell } from "@/components/inline-trip-date-cell";
import { createCompute } from "@backend/compute";
import { loadAppDataForPage } from "@/lib/page-data";
import { formatZAR } from "@/lib/utils";

export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const { data, dbError } = await loadAppDataForPage();
  const {
    aggregateTrip,
    balanceForClient,
    displayTripStatus,
    totalPaidForClient,
  } = createCompute(data);
  const agg = aggregateTrip(tripId);
  if (!agg) notFound();

  const status = displayTripStatus(agg.trip, agg);

  const tripOptions = data.trips.map((t) => ({
    id: t.id,
    name: t.name,
    destination: t.destination,
    departureDate: t.departureDate,
  }));

  return (
    <div className="space-y-8">
      {dbError ? <DbConnectionBanner message={dbError} /> : null}
      <Link
        href="/trips"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to trips
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {agg.trip.name}
          </h1>
          <p className="mt-1 text-muted-foreground">{agg.trip.destination}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TripStatusBadge status={status} />
            <Badge variant="outline" className="gap-1.5 font-normal">
              <span className="text-muted-foreground">Departs</span>
              <InlineTripDateCell
                tripId={agg.trip.id}
                departureDate={agg.trip.departureDate}
              />
            </Badge>
          </div>
        </div>
        <Card className="w-full md:max-w-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Payment status (this departure)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Total amount to be paid</p>
              <p className="font-semibold tabular-nums">
                {formatZAR(agg.totalExpectedRevenue)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Amount paid</p>
              <p className="font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                {formatZAR(agg.totalPaid)}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Outstanding amount</p>
              <p className="text-lg font-bold tabular-nums">
                {formatZAR(agg.outstanding)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Headcount & fill
            </CardTitle>
            <CardDescription>
              Pax count drives vehicle size and when to commit lodge blocks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold">{agg.confirmedCount}</span>
              <span className="text-muted-foreground">
                / {agg.trip.capacity} seats
              </span>
            </div>
            <Progress value={agg.fillRatio * 100} />
            <p className="text-sm text-muted-foreground">{agg.planningHeadline}</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bus className="h-4 w-4" />
              Transport suggestion
            </CardTitle>
            <CardDescription>
              Suggested fleet size from current pax — fewer last-minute bus vs
              minibus mistakes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{agg.transportSuggestion}</p>
            <Separator className="my-4" />
            <div className="flex gap-2">
              <BedDouble className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Accommodation planning</p>
                <p className="text-sm text-muted-foreground">
                  {agg.trip.accommodationNote}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">Travellers on this departure</CardTitle>
            <CardDescription>
              Open a name for balances; every payment has its own invoice record.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AddClientDialog
              trips={tripOptions}
              defaultTripId={agg.trip.id}
              lockTrip
              triggerLabel="Add person"
            />
            {agg.clients.length > 0 ? (
              <DeleteClientsBulkButton
                mode={{
                  kind: "trip",
                  tripId: agg.trip.id,
                  label: agg.trip.name,
                  count: agg.clients.length,
                }}
                redirectTo="/"
              />
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="hidden sm:table-cell">Contact</TableHead>
                <TableHead className="text-right">Package</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[72px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agg.clients.map((c) => {
                const paid = totalPaidForClient(c.id);
                const bal = balanceForClient(c);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        href={`/clients/${c.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      <div className="text-xs">{c.phone}</div>
                      <div className="text-xs">{c.email}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatZAR(c.packagePrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {c.discount > 0 ? `− ${formatZAR(c.discount)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-800 dark:text-emerald-300">
                      {formatZAR(paid)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatZAR(bal)}
                    </TableCell>
                    <TableCell>
                      <ClientFullyPaidBadge balance={bal} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteClientButton
                        clientId={c.id}
                        clientName={c.fullName}
                        size="icon"
                        variant="ghost"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
