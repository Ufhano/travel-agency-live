import Link from "next/link";
import { Plus } from "lucide-react";
import { GroupBookingsList } from "@/components/group-bookings-list";
import { DbConnectionBanner } from "@/components/db-connection-banner";
import { Button } from "@/components/ui/button";
import { loadAppDataForPage } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function GroupBookingsPage() {
  const { dbError } = await loadAppDataForPage();

  return (
    <div className="space-y-6">
      {dbError ? <DbConnectionBanner message={dbError} /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Group fare splits
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Split a bulk group payment across individual passengers for a single
            trip. Track who has paid their share.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" asChild>
          <Link href="/group-bookings/new">
            <Plus className="h-4 w-4" />
            New group booking
          </Link>
        </Button>
      </div>
      <GroupBookingsList />
    </div>
  );
}
