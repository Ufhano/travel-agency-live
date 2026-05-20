"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteClientButton } from "@/components/delete-client-button";
import { EditClientDialog } from "@/components/edit-client-dialog";
import type { Client, Trip } from "@backend/types";

export function ClientRowActions({
  client,
  trips,
}: {
  client: Client;
  trips: Trip[];
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <EditClientDialog
        client={client}
        trips={trips}
        renderTrigger={({ onOpen }) => (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onOpen}
            aria-label={`Edit ${client.fullName}`}
          >
            <Pencil className="h-4 w-4 shrink-0" />
          </Button>
        )}
      />
      <DeleteClientButton
        clientId={client.id}
        clientName={client.fullName}
        size="icon"
        variant="ghost"
      />
    </div>
  );
}
