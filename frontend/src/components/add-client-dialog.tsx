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
import { cn } from "@/lib/utils";

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
  const [form, setForm] = React.useState<FormState>(() =>
    emptyForm(trips[0]?.id ?? ""),
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(emptyForm(trips[0]?.id ?? ""));
      setError(null);
    }
  }, [open, trips]);

  const noTrips = trips.length === 0;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
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
    <Dialog open={open} onOpenChange={setOpen}>
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

        {noTrips ? (
          <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-950/40 dark:text-amber-200">
            You don&apos;t have any trips yet. Import or create a trip before
            adding clients.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="add-client-trip">Trip / departure</Label>
              <select
                id="add-client-trip"
                required
                value={form.tripId}
                onChange={(e) => update("tripId", e.target.value)}
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                )}
              >
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.destination} ({t.departureDate})
                  </option>
                ))}
              </select>
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
                  required
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
