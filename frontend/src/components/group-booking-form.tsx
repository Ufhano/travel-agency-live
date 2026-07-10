"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { formatZAR } from "@/lib/utils";
import type { Trip } from "@backend/types";

type PassengerDraft = {
  key: string;
  passengerName: string;
  passengerEmail: string;
  amount: string;
};

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

let passengerKeyCounter = 0;
function nextPassengerKey(): string {
  passengerKeyCounter += 1;
  return `p-${passengerKeyCounter}`;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function GroupBookingForm({
  trips,
  packageHintByTrip = {},
}: {
  trips: Trip[];
  packageHintByTrip?: Record<string, number>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tripId, setTripId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [packagePricePerPerson, setPackagePricePerPerson] = useState("");
  const [paidAt, setPaidAt] = useState(todayIsoDate);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [passengers, setPassengers] = useState<PassengerDraft[]>([
    { key: nextPassengerKey(), passengerName: "", passengerEmail: "", amount: "" },
    { key: nextPassengerKey(), passengerName: "", passengerEmail: "", amount: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const sortedTrips = useMemo(
    () =>
      [...trips].sort((a, b) => a.departureDate.localeCompare(b.departureDate)),
    [trips],
  );

  const allocationSum = useMemo(() => {
    let sum = 0;
    for (const p of passengers) {
      const n = Number(p.amount);
      if (Number.isFinite(n)) sum += n;
    }
    return Math.round(sum);
  }, [passengers]);

  const totalNum = Number(totalAmount);
  const packageNum = Number(packagePricePerPerson);
  const totalsMatch =
    Number.isFinite(totalNum) &&
    totalNum > 0 &&
    allocationSum === Math.round(totalNum);
  const packageValid = Number.isFinite(packageNum) && packageNum > 0;

  function onTripChange(nextTripId: string) {
    setTripId(nextTripId);
    const hint = packageHintByTrip[nextTripId];
    if (hint && hint > 0) {
      setPackagePricePerPerson(String(hint));
    }
  }

  function addPassenger() {
    setPassengers((prev) => [
      ...prev,
      { key: nextPassengerKey(), passengerName: "", passengerEmail: "", amount: "" },
    ]);
  }

  function removePassenger(key: string) {
    setPassengers((prev) =>
      prev.length <= 1 ? prev : prev.filter((p) => p.key !== key),
    );
  }

  function updatePassenger(
    key: string,
    field: keyof Omit<PassengerDraft, "key">,
    value: string,
  ) {
    setPassengers((prev) =>
      prev.map((p) => (p.key === key ? { ...p, [field]: value } : p)),
    );
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tripId) {
      toast("Select a trip.", "error");
      return;
    }
    if (!proofFile) {
      toast("Upload a proof of payment PDF.", "error");
      return;
    }
    if (!paidAt) {
      toast("Enter the payment date.", "error");
      return;
    }
    if (!Number.isFinite(totalNum) || totalNum <= 0) {
      toast("Enter a valid total amount.", "error");
      return;
    }
    if (!packageValid) {
      toast("Enter a valid package price per person.", "error");
      return;
    }
    if (!totalsMatch) {
      toast(
        `Passenger amounts (${formatZAR(allocationSum)}) must equal total (${formatZAR(Math.round(totalNum))}).`,
        "error",
      );
      return;
    }

    setSubmitting(true);
    try {
      const body = new FormData();
      body.set("tripId", tripId);
      body.set("totalAmount", String(Math.round(totalNum)));
      body.set("packagePricePerPerson", String(Math.round(packageNum)));
      body.set("paidAt", paidAt);
      body.set(
        "passengers",
        JSON.stringify(
          passengers.map((p) => ({
            passengerName: p.passengerName.trim(),
            passengerEmail: p.passengerEmail.trim(),
            amount: Math.round(Number(p.amount)),
          })),
        ),
      );
      body.set("file", proofFile);

      const res = await fetch("/api/group-bookings", {
        method: "POST",
        body,
      });
      const json = (await res.json()) as {
        error?: string;
        groupBooking?: { id: string; referenceNumber: string };
      };

      if (!res.ok) {
        toast(json.error ?? "Could not create group booking.", "error");
        return;
      }

      toast(
        `Group booking ${json.groupBooking?.referenceNumber ?? ""} created.`,
        "success",
      );
      router.push(`/group-bookings/${json.groupBooking?.id ?? ""}`);
      router.refresh();
    } catch {
      toast("Could not reach the server.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trip &amp; total payment</CardTitle>
          <CardDescription>
            Select the departure, enter the bulk group payment received, and the
            full package price per person.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tripId">Trip</Label>
            <select
              id="tripId"
              className={selectClassName}
              value={tripId}
              onChange={(e) => onTripChange(e.target.value)}
              required
            >
              <option value="">Choose a departure…</option>
              {sortedTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.destination})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="packagePricePerPerson">Package price per person</Label>
            <Input
              id="packagePricePerPerson"
              type="number"
              min={1}
              step={1}
              className="tabular-nums"
              placeholder="e.g. 10000"
              value={packagePricePerPerson}
              onChange={(e) => setPackagePricePerPerson(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="totalAmount">Group payment received</Label>
            <Input
              id="totalAmount"
              type="number"
              min={1}
              step={1}
              className="tabular-nums"
              placeholder="e.g. 15000"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paidAt">Payment date</Label>
            <Input
              id="paidAt"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proof of payment</CardTitle>
          <CardDescription>PDF only (max 6 MB)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => onFilePicked(e.target.files)}
          />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Passenger split</CardTitle>
            <CardDescription>
              Enter each passenger&apos;s share of the group payment. Amounts must
              add up to the group payment total. Email is optional.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={addPassenger}
          >
            <Plus className="h-4 w-4" />
            Add passenger
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {passengers.map((p, index) => (
            <div
              key={p.key}
              className="grid gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-[1fr_1fr_8rem_auto]"
            >
              <div className="space-y-1.5">
                <Label htmlFor={`name-${p.key}`}>Name</Label>
                <Input
                  id={`name-${p.key}`}
                  placeholder={`Passenger ${index + 1}`}
                  value={p.passengerName}
                  onChange={(e) =>
                    updatePassenger(p.key, "passengerName", e.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`email-${p.key}`}>Email</Label>
                <Input
                  id={`email-${p.key}`}
                  type="email"
                  placeholder="name@example.com (optional)"
                  value={p.passengerEmail}
                  onChange={(e) =>
                    updatePassenger(p.key, "passengerEmail", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`amount-${p.key}`}>Amount</Label>
                <Input
                  id={`amount-${p.key}`}
                  type="number"
                  min={1}
                  step={1}
                  className="tabular-nums"
                  placeholder="0"
                  value={p.amount}
                  onChange={(e) =>
                    updatePassenger(p.key, "amount", e.target.value)
                  }
                  required
                />
              </div>
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removePassenger(p.key)}
                  disabled={passengers.length <= 1}
                  aria-label="Remove passenger"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm">
            <span className="text-muted-foreground">Allocated total</span>
            <span
              className={
                totalsMatch
                  ? "font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"
                  : "font-semibold tabular-nums text-amber-700 dark:text-amber-300"
              }
            >
              {formatZAR(allocationSum)}
              {Number.isFinite(totalNum) && totalNum > 0
                ? ` / ${formatZAR(Math.round(totalNum))}`
                : null}
            </span>
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={
          submitting ||
          !totalsMatch ||
          !packageValid ||
          sortedTrips.length === 0 ||
          !proofFile
        }
        className="gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating…
          </>
        ) : (
          <>
            <Users className="h-4 w-4" />
            Create group booking
          </>
        )}
      </Button>
    </form>
  );
}
