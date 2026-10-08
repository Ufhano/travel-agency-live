"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function GroupSplitInlineName({
  passengerId,
  name,
  className,
  onSaved,
}: {
  passengerId: string;
  name: string;
  className?: string;
  onSaved?: (name: string) => void;
}) {
  const router = useRouter();
  const initial = name.trim();
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
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Enter the passenger name.");
      return;
    }
    if (trimmed === initial) {
      setEditing(false);
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/gs/${passengerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passengerName: trimmed }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not save the name.");
        return;
      }
      setEditing(false);
      onSaved?.(trimmed);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Network error — please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(initial);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <span className={cn("group inline-flex min-w-0 items-center gap-1", className)}>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-w-0 text-left hover:underline"
          title="Click to correct this name"
        >
          {initial}
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Edit name for ${initial}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 flex-col gap-1", className)}>
      <span className="flex min-w-[12rem] items-center gap-1">
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
          className="h-8 max-w-xs text-sm font-normal"
          aria-label="Passenger name"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void commit()}
          className="shrink-0 rounded p-1 text-emerald-700 hover:bg-muted disabled:opacity-50"
          aria-label="Save name"
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
      </span>
      {error ? (
        <span className="text-[11px] font-normal text-destructive">{error}</span>
      ) : (
        <span className="text-[11px] font-normal text-muted-foreground">
          Enter to save · Esc to cancel
        </span>
      )}
    </span>
  );
}
