"use client";

import type { Client } from "@backend/types";
import { ClientInlineContactField } from "@/components/client-inline-contact-field";
import { cn } from "@/lib/utils";

/** Phone, email, and inline ID on the traveller detail header. */
export function ClientContactHeader({
  client,
  className,
}: {
  client: Client;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground",
        className,
      )}
    >
      <ClientInlineContactField client={client} field="email" variant="inline" />
      <ClientInlineContactField client={client} field="phone" variant="inline" />
      <ClientInlineContactField client={client} field="idNumber" variant="inline" />
    </div>
  );
}
