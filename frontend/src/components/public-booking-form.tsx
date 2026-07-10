"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatZAR } from "@/lib/utils";

type Props = {
  tripId: string;
  tripName: string;
  packagePrice: number;
};

export function PublicBookingForm({ tripId, tripName, packagePrice }: Props) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          fullName,
          phone,
          email,
          idNumber: idNumber.trim() || null,
        }),
      });

      const data = (await res.json()) as {
        redirectUrl?: string;
        error?: string;
      };

      if (!res.ok || !data.redirectUrl) {
        setError(data.error ?? "Could not start checkout. Please try again.");
        setLoading(false);
        return;
      }

      window.location.assign(data.redirectUrl);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border bg-card p-6 shadow-sm space-y-4"
    >
      <div>
        <h2 className="text-lg font-semibold">Your details</h2>
        <p className="text-sm text-muted-foreground mt-1">
          We&apos;ll reserve your seat on <span className="font-medium">{tripName}</span> before
          you pay {formatZAR(packagePrice)} securely via Yoco.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          required
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          required
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="idNumber">ID / passport number (optional)</Label>
        <Input
          id="idNumber"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          disabled={loading}
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "Redirecting to payment…" : `Book now — ${formatZAR(packagePrice)}`}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        You&apos;ll be redirected to Yoco&apos;s secure checkout. Payment confirmation is sent by
        email once processed.
      </p>
    </form>
  );
}
