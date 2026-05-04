import type { ComponentProps } from "react";
import type { ClientPaymentStatus } from "@backend/types";
import { Badge } from "@/components/ui/badge";

const map: Record<
  ClientPaymentStatus,
  { variant: ComponentProps<typeof Badge>["variant"] }
> = {
  "Paid in Full": { variant: "success" },
  "Partial Payment": { variant: "secondary" },
  "Deposit Paid": { variant: "outline" },
  Overdue: { variant: "destructive" },
};

export function PaymentStatusBadge({ status }: { status: ClientPaymentStatus }) {
  return <Badge variant={map[status].variant}>{status}</Badge>;
}
