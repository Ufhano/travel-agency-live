"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

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
  const { confirm, toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const query =
    mode.kind === "trip"
      ? `tripId=${encodeURIComponent(mode.tripId)}`
      : `destination=${encodeURIComponent(mode.destination)}`;

  const onClick = async () => {
    const noun = `${mode.count} traveller${mode.count === 1 ? "" : "s"}`;
    const ok = await confirm(
      `Delete ${noun} for ${mode.label} and their payment records? This cannot be undone.`,
      { confirmLabel: `Delete ${noun}` },
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/clients?${query}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; deletedCount?: number }
        | null;
      if (!res.ok) {
        toast(data?.error ?? `Delete failed (${res.status}).`, "error");
        return;
      }
      toast(`Deleted ${noun} for ${mode.label}.`, "success");
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch {
      toast("Could not reach the server.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={loading}
      onClick={() => void onClick()}
    >
      {loading ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
      )}
      Delete group ({mode.count})
    </Button>
  );
}
