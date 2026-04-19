import { notFound } from "next/navigation";
import { InvoicePrintBody } from "@/components/invoice-print-body";
import { InvoiceToolbar } from "@/components/invoice-toolbar";
import { enrichPayment, getPaymentById } from "@/lib/compute";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const payment = getPaymentById(paymentId);
  if (!payment) notFound();
  const ctx = enrichPayment(payment);
  if (!ctx) notFound();

  return (
    <div className="space-y-6">
      <InvoiceToolbar clientId={ctx.client.id} tripId={ctx.trip.id} />
      <InvoicePrintBody ctx={ctx} />
    </div>
  );
}
