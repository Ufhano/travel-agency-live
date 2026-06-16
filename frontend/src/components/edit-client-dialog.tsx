"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TripPickerField } from "@/components/trip-picker-field";
import { renameTripLabel } from "@/lib/trip-api";
import type { Client, Trip } from "@backend/types";

type TripOption = {
  id: string;
  name: string;
  destination: string;
  departureDate: string;
};

function toTripOptions(trips: Trip[]): TripOption[] {
  return trips.map((t) => ({
    id: t.id,
    name: t.name,
    destination: t.destination,
    departureDate: t.departureDate,
  }));
}

type FormState = {
  tripId: string;
  tripLabel: string;
  fullName: string;
  phone: string;
  email: string;
  idNumber: string;
  packagePrice: string;
  balanceDueDate: string;
};

function clientToForm(c: Client, trips: Trip[]): FormState {
  const trip = trips.find((t) => t.id === c.tripId);
  return {
    tripId: c.tripId,
    tripLabel: trip?.name ?? "",
    fullName: c.fullName,
    phone: c.phone,
    email: c.email,
    idNumber: c.idNumber ?? "",
    packagePrice: String(c.packagePrice),
    balanceDueDate: c.balanceDueDate.slice(0, 10),
  };
}

export type EditClientDialogProps = {
  client: Client;
  trips: Trip[];
  /** Controlled mode: parent owns `open` (e.g. several buttons opening one dialog). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Uncontrolled only: custom control that calls `onOpen` to open the dialog. */
  renderTrigger?: (ctx: { onOpen: () => void }) => React.ReactNode;
};

export function EditClientDialog({
  client,
  trips,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  renderTrigger,
}: EditClientDialogProps) {
  const router = useRouter();
  const options = React.useMemo(() => toTripOptions(trips), [trips]);
  const isControlled = controlledOnOpenChange !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = isControlled ? Boolean(controlledOpen) : uncontrolledOpen;
  const setOpen = React.useCallback(
    (v: boolean) => {
      if (isControlled) controlledOnOpenChange(v);
      else setUncontrolledOpen(v);
    },
    [isControlled, controlledOnOpenChange],
  );

  const [form, setForm] = React.useState<FormState>(() =>
    clientToForm(client, trips),
  );
  const [showAssignOther, setShowAssignOther] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(clientToForm(client, trips));
      setShowAssignOther(false);
      setError(null);
    }
  }, [open, client, trips]);

  const noTrips = options.length === 0;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || noTrips) return;
    setError(null);
    if (!form.tripLabel.trim()) {
      setError("Trip / departure name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const currentTrip = options.find((o) => o.id === form.tripId);
      if (
        currentTrip &&
        form.tripLabel.trim() !== currentTrip.name.trim()
      ) {
        const renamed = await renameTripLabel(form.tripId, form.tripLabel);
        if (!renamed.ok) {
          setError(renamed.error);
          return;
        }
      }

      const res = await fetch("/api/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: client.id,
          tripId: form.tripId,
          fullName: form.fullName,
          phone: form.phone,
          email: form.email,
          idNumber: form.idNumber.trim() || null,
          packagePrice: Number(form.packagePrice),
          balanceDueDate: form.balanceDueDate,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? `Failed to update (HTTP ${res.status}).`);
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

  const triggerEl = !isControlled ? (
    renderTrigger ? (
      renderTrigger({ onOpen: () => setOpen(true) })
    ) : (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
    )
  ) : null;

  return (
    <>
      {triggerEl}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit traveller &amp; departure</DialogTitle>
            <DialogDescription>
              Change contact or package details, or move this traveller to another
              departure. Existing payments and invoices stay on this record; if you
              change the trip, those lines follow the new departure.
            </DialogDescription>
          </DialogHeader>

          {noTrips ? (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-950/40 dark:text-amber-200">
              There are no trips to assign. Create a trip before editing this
              client.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-client-trip-label">Trip / departure</Label>
                <Input
                  id="edit-client-trip-label"
                  required
                  value={form.tripLabel}
                  onChange={(e) => update("tripLabel", e.target.value)}
                  placeholder="e.g. Lesotho Snowcation 04 July 2026"
                />
                <p className="text-xs text-muted-foreground">
                  Type the trip name as it should appear on invoices and the
                  dashboard chart. Saves when you submit this form.
                </p>
              </div>

              <div className="rounded-md border border-dashed p-3">
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setShowAssignOther((v) => !v)}
                >
                  {showAssignOther
                    ? "Hide list of other departures"
                    : "Move this traveller to a different existing departure"}
                </button>
                {showAssignOther ? (
                  <div className="mt-3">
                    <TripPickerField
                      id="edit-client-trip-reassign"
                      label="Existing departure"
                      options={options}
                      value={form.tripId}
                      onChange={(tripId) => {
                        const t = options.find((o) => o.id === tripId);
                        update("tripId", tripId);
                        if (t) update("tripLabel", t.name);
                      }}
                      hint="Pick another departure to reassign this traveller."
                    />
                  </div>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-client-name">Full name</Label>
                <Input
                  id="edit-client-name"
                  required
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  placeholder="e.g. Thandi Nkosi"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit-client-phone">Phone</Label>
                  <Input
                    id="edit-client-phone"
                    required
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="+27 82 555 0123"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-client-email">Email</Label>
                  <Input
                    id="edit-client-email"
                    required
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="thandi@example.com"
                  />
                  <Label htmlFor="edit-client-id" className="text-xs text-muted-foreground">
                    ID number
                  </Label>
                  <Input
                    id="edit-client-id"
                    inputMode="text"
                    autoComplete="off"
                    value={form.idNumber}
                    onChange={(e) => update("idNumber", e.target.value)}
                    placeholder="ID number (optional)"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit-client-price">Package price (ZAR)</Label>
                  <Input
                    id="edit-client-price"
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
                  <Label htmlFor="edit-client-due">Balance due date</Label>
                  <Input
                    id="edit-client-due"
                    required
                    type="date"
                    value={form.balanceDueDate}
                    onChange={(e) => update("balanceDueDate", e.target.value)}
                  />
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </div>
              ) : null}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={submitting}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={submitting || noTrips}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
