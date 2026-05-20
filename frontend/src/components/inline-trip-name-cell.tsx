"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { renameTripLabel } from "@/lib/trip-api";
import { cn } from "@/lib/utils";

/**
 * Inline editable trip label in the traveller table (updates the departure record).
 */
export function InlineTripNameCell({
  tripId,
  initialName,
  className,
}: {
  tripId: string;
  initialName: string;
  className?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(initialName);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!editing) setDraft(initialName);
  }, [initialName, editing]);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function commit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Enter a trip name.");
      return;
    }
    if (trimmed === initialName.trim()) {
      setEditing(false);
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);
    const result = await renameTripLabel(tripId, trimmed);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  function cancel() {
    setDraft(initialName);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className={cn("group flex min-w-0 items-center gap-1", className)}>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-w-0 text-left text-primary hover:underline"
          title="Click to edit trip name"
        >
          <span className="break-words">{initialName}</span>
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          aria-label="Edit trip name"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("min-w-[10rem] space-y-1", className)}>
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
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
          aria-label="Trip name"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void commit()}
          className="shrink-0 rounded p-1 text-emerald-700 hover:bg-muted disabled:opacity-50"
          aria-label="Save trip name"
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
        <p className="text-[11px] text-muted-foreground">Enter to save · Esc to cancel</p>
      )}
    </div>
  );
}
