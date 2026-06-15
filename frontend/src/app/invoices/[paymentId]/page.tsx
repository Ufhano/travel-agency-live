import { notFound } from "next/navigation";

import { InvoicePrintBody } from "@/components/invoice-print-body";

import { InvoiceToolbar } from "@/components/invoice-toolbar";

import { DbConnectionBanner } from "@/components/db-connection-banner";

import { createCompute } from "@backend/compute";

import { loadAppDataForPage } from "@/lib/page-data";



export default async function InvoiceDetailPage({

  params,

}: {

  params: Promise<{ paymentId: string }>;

}) {

  const { paymentId } = await params;

  const { data: app, dbError } = await loadAppDataForPage();

  const { enrichPayment, getPaymentById } = createCompute(app);

  const payment = getPaymentById(paymentId);

  if (!payment) notFound();

  const ctx = enrichPayment(payment);

  if (!ctx) notFound();



  return (

    <div className="space-y-6">

      {dbError ? <DbConnectionBanner message={dbError} /> : null}

      <InvoiceToolbar

        paymentId={paymentId}

        clientId={ctx.client.id}

        tripId={ctx.trip.id}

        invoiceNumber={ctx.invoiceNumber}

        clientName={ctx.client.fullName}

        clientEmail={ctx.client.email}

        clientPhone={ctx.client.phone}

        tripName={ctx.trip.name}

        amount={ctx.amount}

        balance={ctx.balanceAfter}

      />

      <InvoicePrintBody ctx={ctx} />

    </div>

  );

}

