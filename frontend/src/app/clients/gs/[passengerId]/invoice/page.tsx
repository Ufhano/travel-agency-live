import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { InvoicePrintBody } from "@/components/invoice-print-body";
import { InvoiceToolbar } from "@/components/invoice-toolbar";
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { createCompute } from "@backend/compute";
import {
  getTenantGroupSplitPassengerById,
  listGroupBookingFollowUpPayments,
  passengerBalance,
} from "@backend/group-booking";
import { resolveInvoiceTermsForTrip } from "@backend/invoice-terms";
import { getSql } from "@backend/db";
import type { Client, PaymentWithContext, Trip } from "@backend/types";
import { loadAppDataForPage } from "@/lib/page-data";

function syntheticClient(
  passenger: {
    id: string;
    tripId: string;
    passengerName: string;
    passengerEmail: string;
    passengerPhone: string;
    passengerIdNumber: string | null;
    packagePrice: number;
    departureDate: string;
  },
): Client {
  return {
    id: passenger.id,
    tripId: passenger.tripId,
    fullName: passenger.passengerName,
    phone: passenger.passengerPhone || "—",
    email: passenger.passengerEmail || "",
    idNumber: passenger.passengerIdNumber,
    packagePrice: passenger.packagePrice,
    discount: 0,
    balanceDueDate: passenger.departureDate,
  };
}

export default async function GroupSplitPassengerInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ passengerId: string }>;
  searchParams: Promise<{ type?: string; paymentId?: string }>;
}) {
  const { passengerId } = await params;
  const { type: typeRaw, paymentId } = await searchParams;
  const type =
    typeRaw === "full"
      ? "full"
      : typeRaw === "receipt"
        ? "receipt"
        : "partial";

  const { data: app, dbError, session } = await loadAppDataForPage();
  const { getTrip } = createCompute(app);
  const sql = getSql();
  if (!sql) notFound();

  const passenger = await getTenantGroupSplitPassengerById(
    sql,
    session.tenantId,
    passengerId,
  );
  if (!passenger) notFound();

  let trip: Trip | undefined = getTrip(passenger.tripId);
  if (!trip) {
    const tripRows = (await sql`
      SELECT
        id,
        name,
        destination,
        departure_date,
        capacity,
        status,
        accommodation_note,
        public_package_price
      FROM trips
      WHERE id = ${passenger.tripId} AND tenant_id = ${session.tenantId}
      LIMIT 1
    `) as {
      id: string;
      name: string;
      destination: string;
      departure_date: string | Date;
      capacity: number;
      status: Trip["status"];
      accommodation_note: string | null;
      public_package_price: number | string | null;
    }[];
    const row = tripRows[0];
    if (!row) notFound();
    trip = {
      id: row.id,
      name: row.name,
      destination: row.destination,
      departureDate:
        row.departure_date instanceof Date
          ? row.departure_date.toISOString().slice(0, 10)
          : String(row.departure_date).slice(0, 10),
      capacity: Number(row.capacity),
      status: row.status,
      accommodationNote: row.accommodation_note ?? "",
      packagePrice:
        row.public_package_price != null &&
        Number(row.public_package_price) > 0
          ? Number(row.public_package_price)
          : null,
    };
  }

  const balance = passengerBalance(passenger);
  const paid = passenger.amountPaid;
  const client = syntheticClient(passenger);
  const profileHref = `/clients/gs/${passengerId}`;

  if (type === "full" && balance > 0) {
    redirect(`${profileHref}/invoice?type=partial`);
  }

  const followUps = (
    await listGroupBookingFollowUpPayments(
      sql,
      session.tenantId,
      passenger.groupBookingId,
    )
  ).filter((p) => p.passengerId === passenger.id);

  let invoiceNumber: string;
  let variant: "payment" | "partial" | "full";
  let ctx: PaymentWithContext;

  if (type === "receipt") {
    variant = "payment";
    if (!paymentId || paymentId === "initial") {
      const amount = passenger.allocatedAmount;
      if (amount <= 0) notFound();
      invoiceNumber = `GS-${passenger.id.slice(-8).toUpperCase()}-01`;
      ctx = {
        id: `gs-init-${passenger.id}`,
        invoiceNumber,
        clientId: passenger.id,
        tripId: trip.id,
        amount,
        paidAt: passenger.paidAt || new Date().toISOString(),
        method: "Group split",
        note: `Initial group payment (${passenger.referenceNumber})`,
        client,
        trip,
        totalPaidAfter: amount,
        balanceAfter: Math.max(0, passenger.packagePrice - amount),
      };
    } else {
      const payment = followUps.find((p) => p.id === paymentId);
      if (!payment) notFound();
      let running = passenger.allocatedAmount;
      for (const p of followUps) {
        running += p.amount;
        if (p.id === payment.id) break;
      }
      invoiceNumber = `GS-${payment.id.slice(-8).toUpperCase()}`;
      ctx = {
        id: payment.id,
        invoiceNumber,
        clientId: passenger.id,
        tripId: trip.id,
        amount: payment.amount,
        paidAt: payment.paidAt,
        method: "Group split",
        note: payment.note || `Payment · ${passenger.referenceNumber}`,
        client,
        trip,
        totalPaidAfter: running,
        balanceAfter: Math.max(0, passenger.packagePrice - running),
      };
    }
  } else if (type === "full") {
    variant = "full";
    invoiceNumber = `FULL-${passenger.id.slice(-8).toUpperCase()}`;
    ctx = {
      id: `gs-full-${passenger.id}`,
      invoiceNumber,
      clientId: passenger.id,
      tripId: trip.id,
      amount: passenger.packagePrice,
      paidAt: passenger.paidAt || new Date().toISOString(),
      method: "Group split",
      note: `${passenger.referenceNumber} · paid in full`,
      client,
      trip,
      totalPaidAfter: passenger.packagePrice,
      balanceAfter: 0,
    };
  } else {
    variant = "partial";
    invoiceNumber = `PARTIAL-${passenger.id.slice(-8).toUpperCase()}`;
    ctx = {
      id: `gs-partial-${passenger.id}`,
      invoiceNumber,
      clientId: passenger.id,
      tripId: trip.id,
      amount: Math.max(paid, 0),
      paidAt: passenger.paidAt || new Date().toISOString(),
      method: "Group split",
      note: `${passenger.referenceNumber} · partial payment`,
      client,
      trip,
      totalPaidAfter: Math.max(paid, 0),
      balanceAfter: balance,
    };
  }

  return (
    <div className="space-y-6">
      {dbError ? <DbConnectionBanner message={dbError} /> : null}
      <Link
        href={profileHref}
        className="no-print inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {passenger.passengerName}
      </Link>

      <InvoiceToolbar
        paymentId=""
        clientId={passenger.id}
        tripId={trip.id}
        invoiceNumber={invoiceNumber}
        clientName={passenger.passengerName}
        clientEmail={passenger.passengerEmail || ""}
        clientPhone={passenger.passengerPhone || "—"}
        tripName={trip.name}
        amount={ctx.amount}
        balance={ctx.balanceAfter}
        profileHref={profileHref}
        invoicesHref={profileHref}
        showDelete={false}
      />

      <InvoicePrintBody
        ctx={ctx}
        variant={variant}
        terms={resolveInvoiceTermsForTrip(app.invoiceTermsConfig, trip.id)}
        tripId={trip.id}
        tripLabel={trip.name}
      />
    </div>
  );
}
