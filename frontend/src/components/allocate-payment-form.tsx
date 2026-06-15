"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plus, Split, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateClientInline } from "@/components/create-client-inline";
import { CreateTripInline } from "@/components/create-trip-inline";
import { useToast } from "@/components/ui/toast";
import { formatZAR } from "@/lib/utils";
import type { Client, Trip } from "@backend/types";

export function AllocatePaymentForm({
  clients,
  trips,
}: {
  clients: Client[];
  trips: Trip[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [clientList, setClientList] = useState<Client[]>(clients);
  const [tripList, setTripList] = useState<Trip[]>(trips);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showCreateTrip, setShowCreateTrip] = useState(false);

  useEffect(() => {
    setClientList(clients);
  }, [clients]);

  useEffect(() => {
    setTripList(trips);
  }, [trips]);

  const [clientId, setClientId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [selectedTripIds, setSelectedTripIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successSummary, setSuccessSummary] = useState<
    { tripName: string; amount: number; invoiceNumber: string }[] | null
  >(null);

  const sortedClients = useMemo(
    () =>
      [...clientList].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }),
      ),
    [clientList],
  );

  const allocationSum = useMemo(() => {
    let sum = 0;
    for (const tripId of selectedTripIds) {
      const raw = allocations[tripId] ?? "";
      const n = Number(raw);
      if (Number.isFinite(n)) sum += n;
    }
    return sum;
  }, [selectedTripIds, allocations]);

  const totalNum = Number(totalAmount);
  const totalsMatch =
    Number.isFinite(totalNum) &&
    totalNum > 0 &&
    Math.round(allocationSum) === Math.round(totalNum);

  function toggleTrip(tripId: string) {
    setSelectedTripIds((prev) => {
      const next = new Set(prev);
      if (next.has(tripId)) next.delete(tripId);
      else next.add(tripId);
      return next;
    });
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
    if (!clientId) {
      toast("Select a client.", "error");
      return;
    }
    if (!proofFile) {
      toast("Upload a proof of payment PDF.", "error");
      return;
    }
    if (!Number.isFinite(totalNum) || totalNum <= 0) {
      toast("Enter a valid total payment amount.", "error");
      return;
    }
    if (selectedTripIds.size === 0) {
      toast("Select at least one trip.", "error");
      return;
    }
    if (!totalsMatch) {
      toast(
        `Allocations (${formatZAR(allocationSum)}) must equal total (${formatZAR(totalNum)}).`,
        "error",
      );
      return;
    }

    const allocList = [...selectedTripIds].map((tripId) => ({
      tripId,
      amount: Math.round(Number(allocations[tripId] ?? 0)),
    }));

    setSubmitting(true);
    setSuccessSummary(null);
    try {
      const body = new FormData();
      body.set("clientId", clientId);
      body.set("totalAmount", String(Math.round(totalNum)));
      body.set("allocations", JSON.stringify(allocList));
      body.set("file", proofFile);

      const res = await fetch("/api/payments/allocate", {
        method: "POST",
        body,
      });
      const json = (await res.json()) as {
        error?: string;
        payments?: {
          paymentId: string;
          tripId: string;
          amount: number;
          invoiceNumber: string;
        }[];
        message?: string;
      };

      if (!res.ok) {
        toast(json.error ?? "Allocation failed.", "error");
        return;
      }

      const summary = (json.payments ?? []).map((p) => {
        const trip = tripList.find((t) => t.id === p.tripId);
        return {
          tripName: trip?.name ?? p.tripId,
          amount: p.amount,
          invoiceNumber: p.invoiceNumber,
        };
      });
      setSuccessSummary(summary);
      toast(json.message ?? "Payment allocated successfully.", "success");
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
          <CardTitle className="text-base">Step 1 — Select client</CardTitle>
          <CardDescription>
            Pick an existing traveller, or create a new one below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            className="h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Choose a traveller…</option>
            {sortedClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowCreateClient((v) => !v)}
            >
              <Plus className="h-4 w-4" />
              {showCreateClient ? "Hide create client" : "Create new client"}
            </Button>
          </div>
          {showCreateClient ? (
            <CreateClientInline
              trips={tripList.map((t) => ({
                id: t.id,
                name: t.name,
                destination: t.destination,
                departureDate: t.departureDate,
              }))}
              defaultTripId={clientList.find((c) => c.id === clientId)?.tripId}
              onCreated={(client) => {
                setClientList((prev) => {
                  if (prev.some((c) => c.id === client.id)) return prev;
                  return [...prev, client];
                });
                setClientId(client.id);
                setShowCreateClient(false);
                toast(`Created ${client.fullName} and selected them.`, "success");
                router.refresh();
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 2 — Proof of payment</CardTitle>
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
        <CardHeader>
          <CardTitle className="text-base">Step 3 — Total payment amount</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            type="number"
            min={1}
            step={1}
            className="h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm tabular-nums shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="e.g. 5000"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            required
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 4 — Allocate across trips</CardTitle>
          <CardDescription>
            Select trips and enter the amount for each. Total must match the
            payment amount above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tripList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No trips yet — create one below, or import departures from the Import page.
            </p>
          ) : tripList.length === 1 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              Only one departure exists in the database. Import your spreadsheet
              and use &ldquo;Create missing departures&rdquo; on the Import page
              to add Lesotho, Mozambique, and other tabs as separate trips.
            </p>
          ) : null}
          {tripList.length > 0
            ? [...tripList]
                .sort((a, b) => a.departureDate.localeCompare(b.departureDate))
                .map((t) => {
              const selected = selectedTripIds.has(t.id);
              return (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 px-3 py-2"
                >
                  <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleTrip(t.id)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className="font-medium">{t.name}</span>
                    <span className="text-muted-foreground">
                      ({t.destination})
                    </span>
                  </label>
                  {selected ? (
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm tabular-nums shadow-sm"
                      placeholder="Amount"
                      value={allocations[t.id] ?? ""}
                      onChange={(e) =>
                        setAllocations((prev) => ({
                          ...prev,
                          [t.id]: e.target.value,
                        }))
                      }
                      required
                    />
                  ) : null}
                </div>
              );
            })
            : null}

          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowCreateTrip((v) => !v)}
            >
              <Plus className="h-4 w-4" />
              {showCreateTrip ? "Hide create trip" : "Create new trip"}
            </Button>
          </div>
          {showCreateTrip ? (
            <CreateTripInline
              onCreated={(trip) => {
                const fullTrip: Trip = {
                  id: trip.id,
                  name: trip.name,
                  destination: trip.destination,
                  departureDate: trip.departureDate,
                  capacity: 40,
                  status: "Open",
                  accommodationNote: "",
                };
                setTripList((prev) => {
                  if (prev.some((t) => t.id === trip.id)) return prev;
                  return [...prev, fullTrip].sort((a, b) =>
                    a.departureDate.localeCompare(b.departureDate),
                  );
                });
                setSelectedTripIds((prev) => new Set([...prev, trip.id]));
                setShowCreateTrip(false);
                toast(`Created “${trip.name}” and added it to the list.`, "success");
                router.refresh();
              }}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm">
            <span className="text-muted-foreground">Allocation total</span>
            <span
              className={
                totalsMatch
                  ? "font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"
                  : "font-semibold tabular-nums text-amber-700 dark:text-amber-300"
              }
            >
              {formatZAR(allocationSum)}
              {Number.isFinite(totalNum) && totalNum > 0
                ? ` / ${formatZAR(totalNum)}`
                : null}
            </span>
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={submitting || !totalsMatch || tripList.length === 0}
        className="gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Allocating…
          </>
        ) : (
          <>
            <Split className="h-4 w-4" />
            Submit allocation
          </>
        )}
      </Button>

      {successSummary && successSummary.length > 0 ? (
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-emerald-900 dark:text-emerald-100">
              <CheckCircle2 className="h-5 w-5" />
              Allocation complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {successSummary.map((row) => (
                <li key={row.invoiceNumber}>
                  <span className="font-medium">{row.tripName}</span> —{" "}
                  {formatZAR(row.amount)} ({row.invoiceNumber})
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </form>
  );
}
