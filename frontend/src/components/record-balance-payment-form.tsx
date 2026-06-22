"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Receipt, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { formatZAR } from "@/lib/utils";

export function RecordBalancePaymentForm({
  clientId,
  tripId,
  balance,
}: {
  clientId: string;
  tripId: string;
  balance: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState<string>(String(Math.round(balance)));
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;

  function currentMonthLabel(): string {
    return new Intl.DateTimeFormat("en-ZA", {
      month: "short",
      year: "2-digit",
    })
      .format(new Date())
      .replace(/\s+/g, "-");
  }

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

    setSubmitting(true);
    try {
      const monthLabel = currentMonthLabel();
      const body = new FormData();
      body.set("clientId", clientId);
      body.set("totalAmount", String(Math.round(amountNum)));
      body.set(
        "allocations",
        JSON.stringify([{ tripId, amount: Math.round(amountNum) }]),
      );
      body.set("method", "Instalment");
      body.set("note", `${monthLabel} instalment`);
      if (proofFile) body.set("file", proofFile);

      const res = await fetch("/api/payments/allocate", {
        method: "POST",
        body,
      });
      const json = (await res.json()) as {
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        toast(json.error ?? "Could not record the payment.", "error");
        return;
      }

      toast(`Recorded ${formatZAR(Math.round(amountNum))}.`, "success");
      clearFile();
      router.refresh();
    } catch {
      toast("Could not reach the server.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Receipt className="h-5 w-5" />
          Record a payment
        </CardTitle>
        <CardDescription>
          This traveller still owes {formatZAR(balance)}. Enter the amount they
          paid (you can edit it for a partial payment) and optionally attach a
          proof of payment PDF.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-wrap items-end gap-4"
        >
          <div className="flex flex-col gap-1">
            <label
              htmlFor="payment-amount"
              className="text-sm font-medium text-muted-foreground"
            >
              Amount (ZAR)
            </label>
            <input
              id="payment-amount"
              type="number"
              min={1}
              step={1}
              className="h-10 w-40 rounded-md border border-input bg-background px-3 text-sm tabular-nums shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">
              Proof of payment (optional)
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => onFilePicked(e.target.files)}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {proofFile ? proofFile.name : "Upload PDF"}
              </Button>
              {proofFile ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
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
            disabled={submitting || !amountValid}
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Receipt className="h-4 w-4" />
                Record payment
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
