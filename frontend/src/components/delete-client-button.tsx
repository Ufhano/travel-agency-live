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
  clientId: string;
  clientName: string;
  /** After delete, navigate here (default: refresh). */
  redirectTo?: string;
  variant?: "default" | "destructive" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
};

export function DeleteClientButton({
  clientId,
  clientName,
  redirectTo,
  variant = "ghost",
  size = "sm",
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
        `/api/clients?clientId=${encodeURIComponent(clientId)}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as { error?: string };
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
          variant={variant}
          size={size}
          className={className}
          title={`Delete ${clientName}`}
        >
          <Trash2 className="h-4 w-4" />
          {size !== "icon" ? <span className="ml-1.5">{label}</span> : null}
          {size === "icon" ? <span className="sr-only">{label}</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete traveller?</DialogTitle>
          <DialogDescription>
            Remove <strong>{clientName}</strong> and all linked payment records.
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
              "Delete traveller"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
