import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GroupBookingForm } from "@/components/group-booking-form";
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { loadAppDataForPage } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function NewGroupBookingPage() {
  const { data, dbError } = await loadAppDataForPage();

  return (
    <div className="space-y-6">
      {dbError ? <DbConnectionBanner message={dbError} /> : null}
      <Link
        href="/group-bookings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to group bookings
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          New group fare split
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Enter the total group payment and allocate each passenger&apos;s share.
          Amounts must add up exactly before you can submit.
        </p>
      </div>
      <GroupBookingForm trips={data.trips} />
    </div>
  );
}
