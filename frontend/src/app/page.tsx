import type { ComponentType } from "react";
import Link from "next/link";
import { ArrowRight, Banknote, Calendar, PiggyBank, Wallet } from "lucide-react";
import { DashboardChart } from "@/components/dashboard-chart";
import { KeyOperationalInsights } from "@/components/key-operational-insights";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TripStatusBadge } from "@/components/trip-status-badge";
import { createCompute } from "@backend/compute";
import { loadAppData } from "@backend/load-app-data";
import { formatDate, formatZAR } from "@/lib/utils";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const asOfDay = formatDate(new Date().toISOString().slice(0, 10));

  const data = await loadAppData();
  const {
    aggregateTrip,
    buildKeyOperationalInsights,
    dashboardSummary,
    displayTripStatus,
  } = createCompute(data);
  const summary = dashboardSummary();
  const keyInsights = buildKeyOperationalInsights();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Trip operations dashboard
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Central trip and payment visibility for planning, collections, and client servicing.
          Balances evaluated as at{" "}
          <span className="font-medium text-foreground">{asOfDay}</span>{" "}
          from your configured data store.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Departures"
          value={String(summary.totalTrips)}
          icon={Calendar}
          hint="Trips on file"
        />
        <MetricCard
          title="Total amount to be paid"
          value={formatZAR(summary.totalAmountToBePaid)}
          icon={Wallet}
          hint="Sum of booked package prices across trips"
        />
        <MetricCard
          title="Amount paid"
          value={formatZAR(summary.totalCollected)}
          icon={PiggyBank}
          hint="Cash applied to traveller packages"
        />
        <MetricCard
          title="Outstanding amount"
          value={formatZAR(summary.totalOutstanding)}
          icon={Banknote}
          hint="Still to collect"
          emphasize
        />
      </div>

      <KeyOperationalInsights insights={keyInsights} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">Departures at a glance</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trip</TableHead>
                    <TableHead className="hidden md:table-cell whitespace-nowrap">
                      Departs
                    </TableHead>
                    <TableHead className="text-right whitespace-normal min-w-[7.5rem] max-w-[10rem] align-bottom leading-tight">
                      Total amount
                      <br />
                      <span className="font-normal">to be paid</span>
                    </TableHead>
                    <TableHead className="text-right whitespace-normal min-w-[6rem] max-w-[9rem] leading-tight">
                      Amount
                      <br />
                      <span className="font-normal">paid</span>
                    </TableHead>
                    <TableHead className="text-right whitespace-normal min-w-[6rem] max-w-[9rem] leading-tight">
                      Outstanding
                      <br />
                      <span className="font-normal">amount</span>
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.tripAggregates.map((agg) => {
                    const status = displayTripStatus(agg.trip, agg);
                    return (
                      <TableRow key={agg.trip.id}>
                        <TableCell>
                          <Link
                            href={`/trips/${agg.trip.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {agg.trip.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {agg.trip.destination}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell whitespace-nowrap text-muted-foreground">
                          {formatDate(agg.trip.departureDate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatZAR(agg.totalExpectedRevenue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-800 dark:text-emerald-300">
                          {formatZAR(agg.totalPaid)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatZAR(agg.outstanding)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <TripStatusBadge status={status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <DashboardChart rows={summary.tripAggregates} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {summary.tripAggregates.map((agg) => (
          <Card key={agg.trip.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{agg.trip.name}</CardTitle>
                  <CardDescription>{agg.trip.destination}</CardDescription>
                </div>
                <TripStatusBadge status={displayTripStatus(agg.trip, agg)} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Departure</span>
                <span className="text-foreground">{formatDate(agg.trip.departureDate)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total amount to be paid</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatZAR(agg.totalExpectedRevenue)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Amount paid</span>
                <span className="font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                  {formatZAR(agg.totalPaid)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Outstanding amount</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatZAR(agg.outstanding)}
                </span>
              </div>
              <Link
                href={`/trips/${agg.trip.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View departure
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
  emphasize,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  emphasize?: boolean;
}) {
  return (
    <Card
      className={
        emphasize
          ? "border-primary/30 bg-primary/[0.04]"
          : undefined
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
