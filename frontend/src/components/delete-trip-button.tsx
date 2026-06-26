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

type Props = {
  tripId: string;
  tripName: string;
  travellerCount?: number;
  /** After delete, navigate here (default: refresh). */
  redirectTo?: string;
  variant?: "default" | "destructive" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
};

export function DeleteTripButton({
  tripId,
  tripName,
  travellerCount = 0,
  redirectTo,
  variant = "ghost",
  size = "icon",
  className,
  label = "Delete",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/trips?tripId=${encodeURIComponent(tripId)}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? `Delete failed (${res.status}).`);
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
          variant={variant}
          size={size}
          className={className}
          title={`Delete ${tripName}`}
        >
          <Trash2 className="h-4 w-4" />
          {size !== "icon" ? <span className="ml-1.5">{label}</span> : null}
          {size === "icon" ? <span className="sr-only">{label}</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete departure?</DialogTitle>
          <DialogDescription>
            Remove <strong>{tripName}</strong>
            {travellerCount > 0
              ? ` and its ${travellerCount} traveller${travellerCount === 1 ? "" : "s"}, along with all linked payments and group bookings.`
              : " and all linked payments and group bookings."}{" "}
            This cannot be undone.
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
              "Delete departure"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
