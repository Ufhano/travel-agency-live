"use client";

import { useRef, useState } from "react";
import { Loader2, Receipt, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatZAR } from "@/lib/utils";

export function RecordGroupSplitPaymentForm({
  groupBookingId,
  passengerId,
  passengerName,
  balance,
  onRecorded,
}: {
  groupBookingId: string;
  passengerId: string;
  passengerName: string;
  balance: number;
  onRecorded: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState(String(Math.round(balance)));
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;

  function onFilePicked(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (
      !file.name.toLowerCase().endsWith(".pdf") &&
      file.type !== "application/pdf"
    ) {
      toast("Only PDF files are accepted as proof of payment", "error");
      return;
    }
    setProofFile(file);
  }

  function clearFile() {
    setProofFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amountValid) {
      toast("Enter a valid payment amount.", "error");
      return;
    }
    if (Math.round(amountNum) > balance) {
      toast(`Amount cannot exceed ${formatZAR(balance)} remaining.`, "error");
      return;
    }

    setSubmitting(true);
    try {
      const body = new FormData();
      body.set("amount", String(Math.round(amountNum)));
      body.set("paidAt", paidAt);
      if (proofFile) body.set("file", proofFile);

      const res = await fetch(
        `/api/group-bookings/${groupBookingId}/passengers/${passengerId}/payments`,
        { method: "POST", body },
      );
      const json = (await res.json()) as { error?: string };

      if (!res.ok) {
        toast(json.error ?? "Could not record the payment.", "error");
        return;
      }

      toast(
        `Recorded ${formatZAR(Math.round(amountNum))} for ${passengerName}.`,
        "success",
      );
      setAmount(String(Math.max(0, balance - Math.round(amountNum))));
      clearFile();
      onRecorded();
    } catch {
      toast("Could not reach the server.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (balance <= 0) return null;

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3"
    >
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Record payment — {formatZAR(balance)} remaining
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label
            htmlFor={`gs-amount-${passengerId}`}
            className="text-xs font-medium text-muted-foreground"
          >
            Amount (ZAR)
          </label>
          <Input
            id={`gs-amount-${passengerId}`}
            type="number"
            min={1}
            max={balance}
            step={1}
            className="h-9 w-32 tabular-nums"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`gs-date-${passengerId}`}
            className="text-xs font-medium text-muted-foreground"
          >
            Date
          </label>
          <Input
            id={`gs-date-${passengerId}`}
            type="date"
            className="h-9 w-36"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            Proof (optional)
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => onFilePicked(e.target.files)}
          />
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {proofFile ? "Change PDF" : "PDF"}
            </Button>
            {proofFile ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={clearFile}
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <Button
          type="submit"
          size="sm"
          className="h-9 gap-1.5"
          disabled={submitting || !amountValid}
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Receipt className="h-3.5 w-3.5" />
          )}
          Add payment
        </Button>
      </div>
      {proofFile ? (
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {proofFile.name}
        </p>
      ) : null}
    </form>
  );
}
