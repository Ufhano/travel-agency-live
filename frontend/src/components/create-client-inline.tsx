"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

import type { Client } from "@backend/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TripPickerField } from "@/components/trip-picker-field";

type TripOption = {
  id: string;
  name: string;
  destination: string;
  departureDate: string;
};

type Props = {
  trips: TripOption[];
  defaultTripId?: string;
  onCreated: (client: Client) => void;
};

export function CreateClientInline({
  trips,
  defaultTripId = "",
  onCreated,
}: Props) {
  const [tripId, setTripId] = useState(defaultTripId || trips[0]?.id || "");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [packagePrice, setPackagePrice] = useState("");
  const [balanceDueDate, setBalanceDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (trips.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Create a departure in Step 4 below first, then you can add a new client here.
      </p>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!trips.some((t) => t.id === tripId)) {
      setError("Choose a departure for this traveller.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          fullName,
          phone,
          email,
          packagePrice: Number(packagePrice),
          balanceDueDate,
        }),
      });
      const json = (await res.json()) as { client?: Client; error?: string };
      if (!res.ok || !json.client) {
        setError(json.error ?? `Could not create client (${res.status}).`);
        return;
      }
      onCreated(json.client);
      setFullName("");
      setPhone("");
      setEmail("");
      setPackagePrice("");
      setBalanceDueDate("");
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
      <p className="text-sm font-medium">Create a new traveller</p>
      <TripPickerField
        id="allocate-new-client-trip"
        label="Primary departure"
        options={trips}
        value={tripId}
        onChange={setTripId}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="allocate-new-client-name">Full name</Label>
          <Input
            id="allocate-new-client-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Thandi Nkosi"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="allocate-new-client-phone">Phone</Label>
          <Input
            id="allocate-new-client-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+27 82 555 0123"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="allocate-new-client-email">Email</Label>
          <Input
            id="allocate-new-client-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="thandi@example.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="allocate-new-client-price">Package price (ZAR)</Label>
          <Input
            id="allocate-new-client-price"
            type="number"
            min={1}
            step={1}
            value={packagePrice}
            onChange={(e) => setPackagePrice(e.target.value)}
            placeholder="12500"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="allocate-new-client-due">Balance due date</Label>
          <Input
            id="allocate-new-client-due"
            type="date"
            value={balanceDueDate}
            onChange={(e) => setBalanceDueDate(e.target.value)}
            required
          />
        </div>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            Creating…
          </>
        ) : (
          <>
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Create client
          </>
        )}
      </Button>
    </form>
  );
}
