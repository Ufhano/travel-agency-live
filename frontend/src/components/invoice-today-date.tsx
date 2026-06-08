"use client";

import { useSyncExternalStore } from "react";
import { formatTodayLong } from "@/lib/utils";

function subscribe() {
  return () => undefined;
}

function getTodayLabel(compact: boolean) {
  if (compact) {
    return new Intl.DateTimeFormat("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date());
  }
  return formatTodayLong();
}

/** Always shows today's date when the invoice is viewed or printed. */
export function InvoiceTodayDate({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const label = useSyncExternalStore(
    subscribe,
    () => getTodayLabel(compact),
    () => getTodayLabel(compact),
  );
  return <span className={className}>{label}</span>;
}
