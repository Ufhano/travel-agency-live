"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function DeleteGroupSplitPassengerButton({
  passengerId,
  passengerName,
  redirectTo = "/clients",
  variant = "ghost",
  size = "icon",
  className,
  label = "Delete",
}: {
  passengerId: string;
  passengerName: string;
  redirectTo?: string;
  variant?: "default" | "destructive" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const { confirm, toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  async function onClick() {
    const ok = await confirm(
      `Delete ${passengerName} from this group booking? Their payments will be removed. This cannot be undone.`,
      { confirmLabel: "Delete traveller" },
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/clients/gs/${passengerId}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        toast(data?.error ?? `Delete failed (${res.status}).`, "error");
        return;
      }
      toast(`Deleted ${passengerName}.`, "success");
      router.push(redirectTo);
    } catch {
      toast("Could not reach the server.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      title={`Delete ${passengerName}`}
      disabled={loading}
      onClick={() => void onClick()}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
      {size !== "icon" ? <span className="ml-1.5">{label}</span> : null}
      {size === "icon" ? <span className="sr-only">{label}</span> : null}
    </Button>
  );
}
