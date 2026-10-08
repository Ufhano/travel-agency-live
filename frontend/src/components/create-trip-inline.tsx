"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type TripOption = {
  id: string;
  name: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  packagePrice?: number | null;
};

type Props = {
  defaultName?: string;
  defaultDestination?: string;
  onCreated: (trip: TripOption) => void;
};

export function CreateTripInline({
  defaultName = "",
  defaultDestination = "",
  onCreated,
}: Props) {
  const [name, setName] = useState(defaultName);
  const [destination, setDestination] = useState(
    defaultDestination || defaultName,
  );
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [packagePrice, setPackagePrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const priceNum = packagePrice.trim() ? Number(packagePrice) : null;
      if (
        packagePrice.trim() &&
        (!Number.isFinite(priceNum) || (priceNum ?? 0) < 0)
      ) {
        setError("Package price must be a non-negative number.");
        setSubmitting(false);
        return;
      }
      if (returnDate && !departureDate) {
        setError("Pick a departure date when you set a return date.");
        setSubmitting(false);
        return;
      }
      if (returnDate && !departureDate) {
        setError("Set a departure date before a return date.");
        setSubmitting(false);
        return;
      }
      if (returnDate && departureDate && returnDate < departureDate) {
        setError("Return date must be on or after the departure date.");
        setSubmitting(false);
        return;
      }
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          destination,
          departureDate: departureDate || undefined,
          returnDate: returnDate || null,
          capacity: 40,
          status: "Open",
          packagePrice:
            priceNum != null && priceNum > 0 ? Math.round(priceNum) : null,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        trip?: TripOption;
        error?: string;
      };
      if (!res.ok || !json.trip) {
        setError(json.error ?? `Could not create trip (${res.status}).`);
        return;
      }
      onCreated(json.trip);
      setName(defaultName);
      setDestination(defaultDestination || defaultName);
      setDepartureDate("");
      setReturnDate("");
      setPackagePrice("");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleCreate}
      className="space-y-3 rounded-lg border border-dashed border-primary/40 bg-background/80 p-4"
    >
      <p className="text-sm font-medium">
        Create a departure first — travellers must belong to a trip.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-trip-name">Trip name</Label>
          <Input
            id="new-trip-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cape Town June 2026"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-trip-destination">Destination</Label>
          <Input
            id="new-trip-destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Cape Town"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-trip-date">Departs (optional)</Label>
          <Input
            id="new-trip-date"
            type="date"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-trip-return">Returns (optional)</Label>
          <Input
            id="new-trip-return"
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-trip-package">Package price (ZAR, optional)</Label>
          <Input
            id="new-trip-package"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={packagePrice}
            onChange={(e) => setPackagePrice(e.target.value)}
            placeholder="e.g. 12500"
          />
        </div>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={submitting || !name.trim()}>
        {submitting ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            Creating…
          </>
        ) : (
          <>
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Create trip
          </>
        )}
      </Button>
    </form>
  );
}
