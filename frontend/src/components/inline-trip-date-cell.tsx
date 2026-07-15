"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Loader2, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { updateTripDepartureDate } from "@/lib/trip-api";
import { cn, formatDate } from "@/lib/utils";

/** YYYY-MM-DD slice usable by a native date input. */
function toDateInputValue(iso: string): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Inline editable departure date for a trip (fixes wrong dates from imports).
 */
export function InlineTripDateCell({
  tripId,
  departureDate,
  className,
}: {
  tripId: string;
  departureDate: string;
  className?: string;
}) {
  const router = useRouter();
  const initial = toDateInputValue(departureDate);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!editing) setDraft(initial);
  }, [initial, editing]);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function commit() {
    if (!draft) {
      setError("Pick a date.");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await updateTripDepartureDate(tripId, draft);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  function cancel() {
    setDraft(initial);
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
          title="Click to edit departure date"
        >
          <span className="whitespace-nowrap">
            {initial ? formatDate(initial) : "Set date"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          aria-label="Edit departure date"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("min-w-[11rem] space-y-1", className)}>
      <div className="flex items-center gap-1">
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="date"
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
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
        <button
          type="button"
          disabled={saving}
          onClick={() => void commit()}
          className="shrink-0 rounded p-1 text-emerald-700 hover:bg-muted disabled:opacity-50"
          aria-label="Save departure date"
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
          Enter to save · Esc to cancel
        </p>
      )}
    </div>
  );
}
