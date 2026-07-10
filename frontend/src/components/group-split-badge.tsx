"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Green pill shown next to group-split passengers on trip lists. */
export function GroupSplitBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "ml-2 border-0 bg-emerald-600 px-1.5 py-0 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm hover:bg-emerald-600",
        className,
      )}
      title="Group split passenger"
    >
      GS
    </Badge>
  );
}
