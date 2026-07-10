import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GroupBookingDetail } from "@/components/group-booking-detail";
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { loadAppDataForPage } from "@/lib/page-data";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function GroupBookingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { dbError } = await loadAppDataForPage();

  return (
    <div className="space-y-6">
      {dbError ? <DbConnectionBanner message={dbError} /> : null}
      <Link
        href="/group-bookings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to group split
      </Link>
      <GroupBookingDetail groupBookingId={id} />
    </div>
  );
}
