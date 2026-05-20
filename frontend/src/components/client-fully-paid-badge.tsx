import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Per-traveller: solid green when balance is cleared, solid red when money is still owing. */
export function ClientFullyPaidBadge({ balance }: { balance: number }) {
  const fullyPaid = balance <= 0;
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-0 font-semibold text-white shadow-sm",
        fullyPaid
          ? "bg-emerald-600 hover:bg-emerald-600/90 dark:bg-emerald-600 dark:hover:bg-emerald-600/90"
          : "bg-red-600 hover:bg-red-600/90 dark:bg-red-600 dark:hover:bg-red-600/90",
      )}
    >
      {fullyPaid ? "Fully paid" : "Not fully paid"}
    </Badge>
  );
}
