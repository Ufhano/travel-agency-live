"use client";

import * as React from "react";
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { termsFromPastedText } from "@backend/invoice-terms";

const TEAL_DEEP = "#00607A";

const textareaClassName =
  "min-h-[2.5rem] w-full resize-y rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type InputMode = "lines" | "paste";

function termsToPaste(terms: string[]): string {
  return terms.join("\n");
}

function InputModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: InputMode;
  onChange: (mode: InputMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-input p-0.5 text-xs">
      <button
        type="button"
        className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
          mode === "lines"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
        disabled={disabled}
        onClick={() => onChange("lines")}
      >
        Line by line
      </button>
      <button
        type="button"
        className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
          mode === "paste"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
        disabled={disabled}
        onClick={() => onChange("paste")}
      >
        Paste all
      </button>
    </div>
  );
}

/**
 * Terms & Conditions block on an invoice. Renders the static numbered list for
 * print/PDF, plus an on-screen "Edit" affordance (hidden from print). Saving
 * updates the trip-specific terms when a trip is linked, otherwise the default.
 */
export function InvoiceTermsSection({
  initialTerms,
  tripId,
  tripLabel,
}: {
  initialTerms: string[];
  tripId?: string;
  tripLabel?: string;
}) {
  const { toast } = useToast();
  const [terms, setTerms] = React.useState<string[]>(initialTerms);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<string[]>(initialTerms);
  const [pasteText, setPasteText] = React.useState(termsToPaste(initialTerms));
  const [inputMode, setInputMode] = React.useState<InputMode>("lines");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTerms(initialTerms);
  }, [initialTerms]);

  function startEdit() {
    const base = terms.length > 0 ? [...terms] : [""];
    setDraft(base);
    setPasteText(termsToPaste(base.filter((t) => t.trim())));
    setInputMode("lines");
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  function updateDraft(index: number, value: string) {
    setDraft((d) => d.map((t, i) => (i === index ? value : t)));
  }

  function addDraft() {
    setDraft((d) => [...d, ""]);
  }

  function removeDraft(index: number) {
    setDraft((d) => d.filter((_, i) => i !== index));
  }

  function switchInputMode(mode: InputMode) {
    if (mode === inputMode) return;
    if (mode === "paste") {
      const cleaned = draft.map((t) => t.trim()).filter((t) => t.length > 0);
      setPasteText(termsToPaste(cleaned));
    } else {
      const lines = termsFromPastedText(pasteText);
      setDraft(lines.length > 0 ? lines : [""]);
    }
    setInputMode(mode);
  }

  function cleanedFromEditor(): string[] {
    if (inputMode === "paste") {
      return termsFromPastedText(pasteText);
    }
    return draft.map((t) => t.trim()).filter((t) => t.length > 0);
  }

  async function save() {
    const cleaned = cleanedFromEditor();
    if (cleaned.length === 0) {
      setError("Add at least one term before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/invoice-terms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms: cleaned,
          tripId: tripId ?? null,
          label: tripLabel,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save terms.");
      setTerms(cleaned);
      setEditing(false);
      const scope = tripId
        ? `for ${tripLabel ?? "this trip"}`
        : "as the default";
      toast(`Invoice terms saved ${scope}.`, "success");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save terms.";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className={`invoice-terms relative mt-10 break-inside-avoid border border-slate-200 bg-slate-50/80 p-5 sm:p-6 print:border-black/20 print:bg-white${
        terms.length > 10 ? " invoice-terms-many" : ""
      }`}
    >
      <h2
        className="text-center text-sm font-bold uppercase tracking-wide sm:text-base"
        style={{ color: TEAL_DEEP }}
      >
        TERMS AND CONDITIONS
      </h2>

      {!editing ? (
        <button
          type="button"
          onClick={startEdit}
          className="no-print absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:text-foreground"
          aria-label="Edit terms and conditions"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      ) : null}

      <ol
        className={`list-none space-y-2.5 text-[13px] leading-relaxed text-slate-800 ${
          editing ? "hidden print:block print:mt-4" : "mt-4"
        }`}
      >
        {terms.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-5 shrink-0 font-medium tabular-nums">
              {i + 1}.
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ol>

      {editing ? (
        <div className="no-print mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            {tripId
              ? `These terms apply to invoices for ${tripLabel ?? "this trip"}.`
              : "These are the default terms for trips without their own set."}
          </p>

          <InputModeToggle
            mode={inputMode}
            onChange={switchInputMode}
            disabled={saving}
          />

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {inputMode === "lines" ? (
            <ol className="space-y-2.5">
              {draft.map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="pt-2 text-xs font-medium tabular-nums text-muted-foreground">
                    {i + 1}.
                  </span>
                  <textarea
                    className={textareaClassName}
                    value={t}
                    rows={2}
                    placeholder="Enter a term…"
                    disabled={saving}
                    onChange={(e) => updateDraft(i, e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label="Remove term"
                    className="mt-1 shrink-0 rounded-md border border-input p-1.5 text-destructive hover:bg-red-50 disabled:opacity-40"
                    disabled={saving}
                    onClick={() => removeDraft(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div>
              <textarea
                className={`${textareaClassName} min-h-[12rem]`}
                value={pasteText}
                rows={10}
                placeholder="Paste your full terms and conditions here — each line becomes one numbered term."
                disabled={saving}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Each non-empty line becomes a separate numbered term.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {inputMode === "lines" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={addDraft}
                disabled={saving}
              >
                <Plus className="h-4 w-4" />
                Add term
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="gap-2"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save terms
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={cancel}
              disabled={saving}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
