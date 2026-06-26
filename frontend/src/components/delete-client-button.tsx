"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

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
  const { confirm, toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const onClick = async () => {
    const ok = await confirm(
      `Delete ${clientName} and all linked payment records? This cannot be undone.`,
      { confirmLabel: "Delete traveller" },
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/clients?clientId=${encodeURIComponent(clientId)}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        toast(data?.error ?? `Delete failed (${res.status}).`, "error");
        return;
      }
      toast(`Deleted ${clientName}.`, "success");
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
      variant={variant}
      size={size}
      className={className}
      title={`Delete ${clientName}`}
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
