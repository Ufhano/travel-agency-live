import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AllocatePaymentForm } from "@/components/allocate-payment-form";
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { loadAppDataForPage } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function AllocatePaymentPage() {
  const { data, dbError } = await loadAppDataForPage();

  return (
    <div className="space-y-6">
      {dbError ? <DbConnectionBanner message={dbError} /> : null}
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to traveller directory
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Multi-trip payment allocation
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Split one proof of payment across multiple trips for a single
          traveller. Each allocation creates a separate invoice record.
        </p>
      </div>
      <AllocatePaymentForm clients={data.clients} trips={data.trips} />
    </div>
  );
}
