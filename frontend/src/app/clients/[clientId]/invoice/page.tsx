import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { InvoicePrintBody } from "@/components/invoice-print-body";
import { InvoiceToolbar } from "@/components/invoice-toolbar";
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { createCompute } from "@backend/compute";
import { resolveInvoiceTermsForTrip } from "@backend/invoice-terms";
import { loadAppDataForPage } from "@/lib/page-data";

export default async function ClientInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { clientId } = await params;
  const { type: typeRaw } = await searchParams;
  const type = typeRaw === "full" ? "full" : "partial";

  const { data: app, dbError } = await loadAppDataForPage();
  const {
    balanceForClient,
    enrichPayment,
    getClient,
    getTrip,
    netPriceForClient,
    paymentsForClient,
    totalPaidForClient,
  } = createCompute(app);

  const client = getClient(clientId);
  if (!client) notFound();
  const trip = getTrip(client.tripId);
  if (!trip) notFound();

  const balance = balanceForClient(client);
  const netPrice = netPriceForClient(client);
  const paid = totalPaidForClient(client.id);
  const payments = paymentsForClient(client.id);

  if (type === "full" && balance > 0) {
    redirect(`/clients/${clientId}/invoice?type=partial`);
  }

  const latest = payments[payments.length - 1];
  const enriched = latest ? enrichPayment(latest) : null;

  const invoiceNumber =
    type === "full"
      ? `FULL-${client.id.slice(-8).toUpperCase()}`
      : `PARTIAL-${client.id.slice(-8).toUpperCase()}`;

  const ctx = enriched
    ? {
        ...enriched,
        invoiceNumber,
        amount: type === "full" ? netPrice : paid,
        totalPaidAfter: type === "full" ? netPrice : paid,
        balanceAfter: type === "full" ? 0 : balance,
      }
    : {
        id: `stmt-${client.id}`,
        invoiceNumber,
        clientId: client.id,
        tripId: trip.id,
        amount: type === "full" ? netPrice : paid,
        paidAt: new Date().toISOString(),
        method: "Statement",
        client,
        trip,
        totalPaidAfter: type === "full" ? netPrice : paid,
        balanceAfter: type === "full" ? 0 : balance,
      };

  const toolbarAmount = type === "full" ? netPrice : paid;
  const toolbarBalance = type === "full" ? 0 : balance;
  const paymentIdForEmail = latest?.id ?? "";

  return (
    <div className="space-y-6">
      {dbError ? <DbConnectionBanner message={dbError} /> : null}
      <Link
        href={`/clients/${clientId}`}
        className="no-print inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {client.fullName}
      </Link>

      {paymentIdForEmail ? (
        <InvoiceToolbar
          paymentId={paymentIdForEmail}
          clientId={client.id}
          tripId={trip.id}
          invoiceNumber={invoiceNumber}
          clientName={client.fullName}
          clientEmail={client.email}
          clientPhone={client.phone}
          tripName={trip.name}
          amount={toolbarAmount}
          balance={toolbarBalance}
        />
      ) : (
        <p className="no-print text-sm text-muted-foreground">
          No payments on file yet — print the statement below. Email and
          WhatsApp need at least one saved payment.
        </p>
      )}

      <InvoicePrintBody
        ctx={ctx}
        variant={type}
        terms={resolveInvoiceTermsForTrip(app.invoiceTermsConfig, trip.id)}
        tripId={trip.id}
        tripLabel={trip.name}
      />
    </div>
  );
}
