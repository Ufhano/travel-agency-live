"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { updateTripPackagePrice } from "@/lib/trip-api";
import { formatZAR } from "@/lib/utils";

type Props = {
  tripId: string;
  packagePrice: number | null;
  /** Compact display for table cells. */
  compact?: boolean;
};

export function InlineTripPackagePrice({
  tripId,
  packagePrice,
  compact = false,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(
    packagePrice != null ? String(packagePrice) : "",
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!editing) {
      setDraft(packagePrice != null ? String(packagePrice) : "");
    }
  }, [packagePrice, editing]);

  async function save() {
    if (saving) return;
    setError(null);
    const trimmed = draft.trim();
    const next =
      trimmed === ""
        ? null
        : Number.isFinite(Number(trimmed))
          ? Math.round(Number(trimmed))
          : NaN;
    if (trimmed !== "" && (!Number.isFinite(next) || (next as number) < 0)) {
      setError("Enter a valid amount.");
      return;
    }
    if (next === packagePrice || (next == null && packagePrice == null)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const result = await updateTripPackagePrice(tripId, next);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        type="button"
        className={
          compact
            ? "tabular-nums text-muted-foreground hover:text-foreground hover:underline"
            : "tabular-nums font-medium text-foreground hover:underline"
        }
        onClick={() => {
          setError(null);
          setEditing(true);
        }}
        title="Click to edit package price"
      >
        {packagePrice != null && packagePrice > 0
          ? formatZAR(packagePrice)
          : "Set price"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          className="h-8 w-[7.5rem] tabular-nums"
          value={draft}
          autoFocus
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            }
            if (e.key === "Escape") {
              setEditing(false);
              setError(null);
              setDraft(packagePrice != null ? String(packagePrice) : "");
            }
          }}
          onBlur={() => {
            void save();
          }}
          aria-label="Package price in ZAR"
        />
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
