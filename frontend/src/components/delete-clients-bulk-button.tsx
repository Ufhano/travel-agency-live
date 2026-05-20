"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type BulkMode =
  | { kind: "trip"; tripId: string; label: string; count: number }
  | { kind: "destination"; destination: string; label: string; count: number };

type Props = {
  mode: BulkMode;
  redirectTo?: string;
  className?: string;
};

export function DeleteClientsBulkButton({ mode, redirectTo, className }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const query =
    mode.kind === "trip"
      ? `tripId=${encodeURIComponent(mode.tripId)}`
      : `destination=${encodeURIComponent(mode.destination)}`;

  const title =
    mode.kind === "trip"
      ? "Delete all travellers on this trip?"
      : "Delete all travellers in this destination?";

  const onConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients?${query}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string; deletedCount?: number };
      if (!res.ok) {
        setError(data.error ?? `Delete failed (${res.status}).`);
        return;
      }
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={className}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete group ({mode.count})
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Remove <strong>{mode.count}</strong> traveller
            {mode.count === 1 ? "" : "s"} for <strong>{mode.label}</strong> and
            their payment records. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={loading}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={loading}
            onClick={() => void onConfirm()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Deleting…
              </>
            ) : (
              `Delete ${mode.count} traveller${mode.count === 1 ? "" : "s"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
