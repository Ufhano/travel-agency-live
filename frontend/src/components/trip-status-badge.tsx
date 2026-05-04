import type { ComponentProps } from "react";
import type { TripStatus } from "@backend/types";
import { Badge } from "@/components/ui/badge";

const map: Record<
  TripStatus | string,
  { variant: ComponentProps<typeof Badge>["variant"]; label: string }
> = {
  Draft: { variant: "muted", label: "Draft" },
  Open: { variant: "secondary", label: "Open" },
  "Filling Fast": { variant: "success", label: "Filling Fast" },
  "Under-filled": { variant: "warning", label: "Under-filled" },
  Confirmed: { variant: "default", label: "Confirmed" },
  Closed: { variant: "outline", label: "Closed" },
};

export function TripStatusBadge({ status }: { status: string }) {
  const m = map[status] ?? { variant: "secondary" as const, label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
