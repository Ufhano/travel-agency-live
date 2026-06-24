import type { ComponentType } from "react";

import { Banknote, Calendar, PiggyBank, Wallet } from "lucide-react";

import { DashboardPaymentHero } from "@/components/dashboard-payment-hero";

import { DashboardDeparturesSection } from "@/components/dashboard-departures-section";

// import { KeyOperationalInsights } from "@/components/key-operational-insights";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { DbConnectionBanner } from "@/components/db-connection-banner";

import { createCompute } from "@backend/compute";

import { loadAppDataForPage } from "@/lib/page-data";

import { formatDate, formatZAR } from "@/lib/utils";

export const dynamic = "force-dynamic";



export default async function DashboardPage() {

  const asOfDay = formatDate(new Date().toISOString().slice(0, 10));



  const { data, dbError, session } = await loadAppDataForPage();

  const {

    // buildKeyOperationalInsights,

    dashboardSummary,

    displayTripStatus,

  } = createCompute(data);

  const summary = dashboardSummary();

  // const keyInsights = buildKeyOperationalInsights();

  const departuresWithClients = summary.tripAggregates.filter(

    (agg) => agg.confirmedCount > 0,

  );



  const departureRows = departuresWithClients.map((agg) => ({

    tripId: agg.trip.id,

    tripName: agg.trip.name,

    destination: agg.trip.destination,

    departureDate: agg.trip.departureDate,

    totalExpectedRevenue: agg.totalExpectedRevenue,

    totalPaid: agg.totalPaid,

    outstanding: agg.outstanding,

    status: displayTripStatus(agg.trip, agg),

  }));



  return (

    <div className="space-y-8">

      {dbError ? <DbConnectionBanner message={dbError} /> : null}

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



      <DashboardPaymentHero

        paid={summary.totalCollected}

        total={summary.totalAmountToBePaid}

        outstanding={summary.totalOutstanding}

        tripCount={departuresWithClients.length}

        asOfDay={asOfDay}

        displayName={session.displayName}

      />



      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <MetricCard

          title="Departures"

          value={String(departuresWithClients.length)}

          icon={Calendar}

          hint="Trips with saved travellers"

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



      {/* <KeyOperationalInsights insights={keyInsights} /> */}



      <DashboardDeparturesSection rows={departureRows} />

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


