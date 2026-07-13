"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function DeleteGroupSplitPaymentButton({
  groupBookingId,
  passengerId,
  paymentId,
  invoiceNumber,
  passengerName,
}: {
  groupBookingId: string;
  passengerId: string;
  paymentId: string;
  invoiceNumber: string;
  passengerName?: string;
}) {
  const router = useRouter();
  const { confirm, toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  async function onClick() {
    const who = passengerName ? ` for ${passengerName}` : "";
    const ok = await confirm(
      `Delete ${invoiceNumber}${who}? The paid total and balance will update. This cannot be undone.`,
      { confirmLabel: "Delete payment" },
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/group-bookings/${groupBookingId}/passengers/${passengerId}/payments/${paymentId}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        toast(data?.error ?? `Delete failed (${res.status}).`, "error");
        return;
      }
      toast(`Deleted ${invoiceNumber}.`, "success");
      router.refresh();
    } catch {
      toast("Could not reach the server.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={`Delete ${invoiceNumber}`}
      disabled={loading}
      onClick={() => void onClick()}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
      <span className="sr-only">Delete {invoiceNumber}</span>
    </Button>
  );
}
