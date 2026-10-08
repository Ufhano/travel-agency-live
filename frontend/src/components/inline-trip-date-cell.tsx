"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Loader2, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { updateTripDates } from "@/lib/trip-api";
import { cn, formatTripDates } from "@/lib/utils";

/** YYYY-MM-DD slice usable by a native date input. */
function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Inline editable departure and return dates.
 * Leave return empty for a one-day departure.
 */
export function InlineTripDateCell({
  tripId,
  departureDate,
  returnDate = null,
  className,
}: {
  tripId: string;
  departureDate: string;
  returnDate?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const initialFrom = toDateInputValue(departureDate);
  const initialTo = toDateInputValue(returnDate);
  const [editing, setEditing] = React.useState(false);
  const [fromDraft, setFromDraft] = React.useState(initialFrom);
  const [toDraft, setToDraft] = React.useState(initialTo);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!editing) {
      setFromDraft(initialFrom);
      setToDraft(initialTo);
    }
  }, [initialFrom, initialTo, editing]);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function commit() {
    if (!fromDraft) {
      setError("Pick a departure date.");
      return;
    }
    if (toDraft && toDraft < fromDraft) {
      setError("Return must be on or after departure.");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await updateTripDates(tripId, fromDraft, toDraft || null);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  function cancel() {
    setFromDraft(initialFrom);
    setToDraft(initialTo);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className={cn("group flex min-w-0 items-center gap-1", className)}>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-w-0 text-left hover:text-foreground hover:underline"
          title="Click to edit trip dates"
        >
          <span className="whitespace-nowrap">
            {initialFrom
              ? formatTripDates(initialFrom, initialTo || null)
              : "Set dates"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Edit trip dates"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("min-w-[16rem] space-y-1", className)}>
      <div className="flex items-center gap-1">
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <label
          className="w-12 shrink-0 text-[11px] text-muted-foreground"
          htmlFor={`trip-from-${tripId}`}
        >
          From
        </label>
        <Input
          id={`trip-from-${tripId}`}
          ref={inputRef}
          type="date"
          value={fromDraft}
          disabled={saving}
          onChange={(e) => setFromDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className="h-8 text-sm"
          aria-label="Departure date"
        />
      </div>
      <div className="flex items-center gap-1 pl-5">
        <label
          className="w-12 shrink-0 text-[11px] text-muted-foreground"
          htmlFor={`trip-to-${tripId}`}
        >
          To
        </label>
        <Input
          id={`trip-to-${tripId}`}
          type="date"
          value={toDraft}
          disabled={saving}
          onChange={(e) => setToDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className="h-8 text-sm"
          aria-label="Return date"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void commit()}
          className="shrink-0 rounded p-1 text-emerald-700 hover:bg-muted disabled:opacity-50"
          aria-label="Save trip dates"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={cancel}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Leave To empty for a one-day trip. Enter to save · Esc to cancel
        </p>
      )}
    </div>
  );
}
