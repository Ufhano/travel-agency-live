import { notFound } from "next/navigation";
import { InvoicePrintBody } from "@/components/invoice-print-body";
import { InvoiceToolbar } from "@/components/invoice-toolbar";
import { createCompute } from "@backend/compute";
import { loadAppData } from "@backend/load-app-data";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const app = await loadAppData();
  const { enrichPayment, getPaymentById } = createCompute(app);
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
