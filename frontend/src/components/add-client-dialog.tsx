"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreateTripInline } from "@/components/create-trip-inline";
import { TripPickerField } from "@/components/trip-picker-field";

type TripOption = {
  id: string;
  name: string;
  destination: string;
  departureDate: string;
};

type FormState = {
  tripId: string;
  fullName: string;
  phone: string;
  email: string;
  packagePrice: string;
  balanceDueDate: string;
};

const emptyForm = (defaultTripId: string): FormState => ({
  tripId: defaultTripId,
  fullName: "",
  phone: "",
  email: "",
  packagePrice: "",
  balanceDueDate: "",
});

export function AddClientDialog({ trips }: { trips: TripOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [tripList, setTripList] = React.useState(trips);
  const [showCreateTrip, setShowCreateTrip] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(() =>
    emptyForm(trips[0]?.id ?? ""),
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTripList(trips);
  }, [trips]);

  function handleOpenChange(next: boolean) {
    if (next) {
      setTripList(trips);
      setForm(emptyForm(trips[0]?.id ?? ""));
      setError(null);
      setShowCreateTrip(trips.length === 0);
    }
    setOpen(next);
  }

  const noTrips = tripList.length === 0;

  function handleTripCreated(trip: TripOption) {
    setTripList((prev) => {
      if (prev.some((t) => t.id === trip.id)) return prev;
      return [...prev, trip].sort((a, b) =>
        a.departureDate.localeCompare(b.departureDate),
      );
    });
    setForm((prev) => ({ ...prev, tripId: trip.id }));
    setShowCreateTrip(false);
    router.refresh();
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    if (!tripList.some((t) => t.id === form.tripId)) {
      setError("Choose a departure from the list (search, then select a row).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: form.tripId,
          fullName: form.fullName,
          phone: form.phone,
          email: form.email,
          packagePrice: Number(form.packagePrice),
          balanceDueDate: form.balanceDueDate,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? `Failed to save (HTTP ${res.status}).`);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Network error — please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add client
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new client</DialogTitle>
          <DialogDescription>
            Tie this traveller to a departure. Balance and payment status will
            compute automatically.
          </DialogDescription>
        </DialogHeader>

        {noTrips || showCreateTrip ? (
          <div className="space-y-4">
            {noTrips ? (
              <p className="text-sm text-muted-foreground">
                Create a departure first, then add the traveller below.
              </p>
            ) : null}
            <CreateTripInline onCreated={handleTripCreated} />
            {!noTrips ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-muted-foreground"
                onClick={() => setShowCreateTrip(false)}
              >
                Back to departure list
              </Button>
            ) : null}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <TripPickerField
                id="add-client-trip"
                label="Trip / departure"
                options={tripList}
                value={form.tripId}
                onChange={(tripId) => update("tripId", tripId)}
              />
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setShowCreateTrip(true)}
              >
                Can&apos;t find your departure? Create a new one
              </Button>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-client-name">Full name</Label>
              <Input
                id="add-client-name"
                required
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="e.g. Thandi Nkosi"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="add-client-phone">Phone</Label>
                <Input
                  id="add-client-phone"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="+27 82 555 0123"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-client-email">Email</Label>
                <Input
                  id="add-client-email"
                  required
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="thandi@example.com"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="add-client-price">Package price (ZAR)</Label>
                <Input
                  id="add-client-price"
                  required
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={form.packagePrice}
                  onChange={(e) => update("packagePrice", e.target.value)}
                  placeholder="12500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-client-due">Balance due date</Label>
                <Input
                  id="add-client-due"
                  required
                  type="date"
                  value={form.balanceDueDate}
                  onChange={(e) => update("balanceDueDate", e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={submitting}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save client"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
