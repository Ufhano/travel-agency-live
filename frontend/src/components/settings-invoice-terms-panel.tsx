"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const textareaClassName =
  "min-h-[2.5rem] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Row = { key: string; value: string };

function rowKey(): string {
  return `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toRows(terms: string[]): Row[] {
  return terms.map((value) => ({ key: rowKey(), value }));
}

export function SettingsInvoiceTermsPanel() {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/invoice-terms");
      const data = (await res.json()) as { terms?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load terms.");
      setRows(toRows(data.terms ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load terms.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  function updateRow(key: string, value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, value } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addRow() {
    setRows((prev) => [...prev, { key: rowKey(), value: "" }]);
  }

  function moveRow(index: number, direction: -1 | 1) {
    setRows((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  async function onSave() {
    const terms = rows.map((r) => r.value.trim()).filter((v) => v.length > 0);
    if (terms.length === 0) {
      setError("Add at least one term before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/invoice-terms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms }),
      });
      const data = (await res.json()) as { terms?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save terms.");
      setRows(toRows(data.terms ?? terms));
      toast("Invoice terms saved.", "success");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save terms.";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function onReset() {
    if (
      !confirm(
        "Reset the invoice terms back to the default template? This replaces your current terms.",
      )
    ) {
      return;
    }
    setResetting(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/invoice-terms", { method: "DELETE" });
      const data = (await res.json()) as { terms?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not reset terms.");
      setRows(toRows(data.terms ?? []));
      toast("Reset to the default terms.", "success");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not reset terms.";
      setError(message);
      toast(message, "error");
    } finally {
      setResetting(false);
    }
  }

  const busy = saving || resetting;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Invoice terms &amp; conditions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These numbered lines appear in the &ldquo;Terms and Conditions&rdquo;
            section of every invoice and statement you print or email.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => void onReset()}
          disabled={busy || loading}
        >
          {resetting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Reset to default
        </Button>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <ol className="mt-5 space-y-3">
            {rows.map((row, index) => (
              <li key={row.key} className="flex items-start gap-2">
                <div className="flex flex-col items-center pt-1.5">
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {index + 1}.
                  </span>
                </div>
                <textarea
                  className={textareaClassName}
                  value={row.value}
                  rows={2}
                  placeholder="Enter a term…"
                  disabled={busy}
                  onChange={(e) => updateRow(row.key, e.target.value)}
                />
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    aria-label="Move term up"
                    className="rounded-md border border-input p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                    disabled={busy || index === 0}
                    onClick={() => moveRow(index, -1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move term down"
                    className="rounded-md border border-input p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                    disabled={busy || index === rows.length - 1}
                    onClick={() => moveRow(index, 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove term"
                    className="rounded-md border border-input p-1 text-destructive hover:bg-red-50 disabled:opacity-40"
                    disabled={busy}
                    onClick={() => removeRow(row.key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={addRow}
              disabled={busy}
            >
              <Plus className="h-4 w-4" />
              Add term
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2"
              onClick={() => void onSave()}
              disabled={busy}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save terms
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
