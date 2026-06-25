"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  newTermsSetId,
  termsFromPastedText,
  type InvoiceTermsConfig,
  type InvoiceTermsSet,
} from "@backend/invoice-terms";

const textareaClassName =
  "min-h-[2.5rem] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type TripOption = {
  id: string;
  name: string;
  destination: string;
  departureDate: string;
};

type Row = { key: string; value: string };
type InputMode = "lines" | "paste";

function rowKey(): string {
  return `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toRows(terms: string[]): Row[] {
  return terms.map((value) => ({ key: rowKey(), value }));
}

function termsToPaste(terms: string[]): string {
  return terms.join("\n");
}

function defaultConfig(): InvoiceTermsConfig {
  return { defaultTerms: [], sets: [] };
}

type ActiveSlide =
  | { kind: "default" }
  | { kind: "set"; setId: string };

function slideCount(config: InvoiceTermsConfig): number {
  return 1 + config.sets.length;
}

function slideLabel(
  slide: ActiveSlide,
  config: InvoiceTermsConfig,
  trips: TripOption[],
): string {
  if (slide.kind === "default") return "Default (all trips)";
  const set = config.sets.find((s) => s.id === slide.setId);
  if (!set) return "Trip terms";
  if (set.tripId) {
    const trip = trips.find((t) => t.id === set.tripId);
    if (trip) return `${trip.name} — ${trip.destination}`;
  }
  return set.label || "Trip terms";
}

function slideIndex(slide: ActiveSlide, config: InvoiceTermsConfig): number {
  if (slide.kind === "default") return 0;
  const ix = config.sets.findIndex((s) => s.id === slide.setId);
  return ix >= 0 ? ix + 1 : 0;
}

function slideAt(index: number, config: InvoiceTermsConfig): ActiveSlide {
  if (index <= 0) return { kind: "default" };
  const set = config.sets[index - 1];
  return set ? { kind: "set", setId: set.id } : { kind: "default" };
}

function getTermsForSlide(
  slide: ActiveSlide,
  config: InvoiceTermsConfig,
): string[] {
  if (slide.kind === "default") return config.defaultTerms;
  const set = config.sets.find((s) => s.id === slide.setId);
  return set?.terms ?? [];
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
    <div className="inline-flex rounded-lg border border-input p-0.5 text-sm">
      <button
        type="button"
        className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
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
        className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
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

export function SettingsInvoiceTermsPanel() {
  const { toast } = useToast();
  const [config, setConfig] = React.useState<InvoiceTermsConfig>(defaultConfig);
  const [trips, setTrips] = React.useState<TripOption[]>([]);
  const [activeSlide, setActiveSlide] = React.useState<ActiveSlide>({
    kind: "default",
  });
  const [rows, setRows] = React.useState<Row[]>([]);
  const [pasteText, setPasteText] = React.useState("");
  const [inputMode, setInputMode] = React.useState<InputMode>("lines");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadEditorFromTerms = React.useCallback((terms: string[]) => {
    setRows(toRows(terms));
    setPasteText(termsToPaste(terms));
  }, []);

  const loadSlide = React.useCallback(
    (slide: ActiveSlide, currentConfig: InvoiceTermsConfig) => {
      loadEditorFromTerms(getTermsForSlide(slide, currentConfig));
      setInputMode("lines");
    },
    [loadEditorFromTerms],
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [termsRes, tripsRes] = await Promise.all([
        fetch("/api/settings/invoice-terms"),
        fetch("/api/trips"),
      ]);
      const termsData = (await termsRes.json()) as InvoiceTermsConfig & {
        error?: string;
      };
      const tripsData = (await tripsRes.json()) as {
        trips?: TripOption[];
        error?: string;
      };
      if (!termsRes.ok) {
        throw new Error(termsData.error ?? "Failed to load terms.");
      }
      const loaded: InvoiceTermsConfig = {
        defaultTerms: termsData.defaultTerms ?? [],
        sets: termsData.sets ?? [],
      };
      setConfig(loaded);
      setTrips(tripsData.trips ?? []);
      const slide: ActiveSlide = { kind: "default" };
      setActiveSlide(slide);
      loadSlide(slide, loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load terms.");
    } finally {
      setLoading(false);
    }
  }, [loadSlide]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function currentTermsFromEditor(): string[] {
    if (inputMode === "paste") {
      return termsFromPastedText(pasteText);
    }
    return rows.map((r) => r.value.trim()).filter((v) => v.length > 0);
  }

  function applyEditorToConfig(
    prev: InvoiceTermsConfig,
    slide: ActiveSlide,
    terms: string[],
  ): InvoiceTermsConfig {
    if (slide.kind === "default") {
      return { ...prev, defaultTerms: terms };
    }
    return {
      ...prev,
      sets: prev.sets.map((s) =>
        s.id === slide.setId ? { ...s, terms } : s,
      ),
    };
  }

  function persistCurrentSlideToConfig(): InvoiceTermsConfig {
    const terms = currentTermsFromEditor();
    const next = applyEditorToConfig(config, activeSlide, terms);
    setConfig(next);
    return next;
  }

  function goToSlide(index: number) {
    const nextConfig = persistCurrentSlideToConfig();
    const total = slideCount(nextConfig);
    const clamped = Math.max(0, Math.min(index, total - 1));
    const slide = slideAt(clamped, nextConfig);
    setActiveSlide(slide);
    loadSlide(slide, nextConfig);
  }

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

  function switchInputMode(mode: InputMode) {
    if (mode === inputMode) return;
    if (mode === "paste") {
      const terms = rows.map((r) => r.value.trim()).filter((v) => v.length > 0);
      setPasteText(termsToPaste(terms));
    } else {
      setRows(toRows(termsFromPastedText(pasteText)));
    }
    setInputMode(mode);
  }

  function updateActiveSet(patch: Partial<InvoiceTermsSet>) {
    if (activeSlide.kind !== "set") return;
    setConfig((prev) => ({
      ...prev,
      sets: prev.sets.map((s) =>
        s.id === activeSlide.setId ? { ...s, ...patch } : s,
      ),
    }));
  }

  function addTripSet() {
    const nextConfig = persistCurrentSlideToConfig();
    const newSet: InvoiceTermsSet = {
      id: newTermsSetId(),
      label: "New trip terms",
      tripId: null,
      terms: [...nextConfig.defaultTerms],
    };
    const updated = { ...nextConfig, sets: [...nextConfig.sets, newSet] };
    setConfig(updated);
    const slide: ActiveSlide = { kind: "set", setId: newSet.id };
    setActiveSlide(slide);
    loadSlide(slide, updated);
  }

  function removeActiveSet() {
    if (activeSlide.kind !== "set") return;
    if (!confirm("Remove this trip terms set?")) return;
    const nextConfig = persistCurrentSlideToConfig();
    const updated = {
      ...nextConfig,
      sets: nextConfig.sets.filter((s) => s.id !== activeSlide.setId),
    };
    setConfig(updated);
    const slide: ActiveSlide = { kind: "default" };
    setActiveSlide(slide);
    loadSlide(slide, updated);
  }

  async function onSave() {
    const terms = currentTermsFromEditor();
    if (terms.length === 0) {
      setError("Add at least one term before saving.");
      return;
    }
    const payload = applyEditorToConfig(config, activeSlide, terms);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/invoice-terms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as InvoiceTermsConfig & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not save terms.");
      const saved: InvoiceTermsConfig = {
        defaultTerms: data.defaultTerms ?? payload.defaultTerms,
        sets: data.sets ?? payload.sets,
      };
      setConfig(saved);
      loadSlide(activeSlide, saved);
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
        "Reset all invoice terms back to the default template? This removes trip-specific sets too.",
      )
    ) {
      return;
    }
    setResetting(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/invoice-terms", {
        method: "DELETE",
      });
      const data = (await res.json()) as InvoiceTermsConfig & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not reset terms.");
      const reset: InvoiceTermsConfig = {
        defaultTerms: data.defaultTerms ?? [],
        sets: data.sets ?? [],
      };
      setConfig(reset);
      const slide: ActiveSlide = { kind: "default" };
      setActiveSlide(slide);
      loadSlide(slide, reset);
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
  const totalSlides = slideCount(config);
  const currentIndex = slideIndex(activeSlide, config);
  const activeSet =
    activeSlide.kind === "set"
      ? config.sets.find((s) => s.id === activeSlide.setId)
      : null;

  const usedTripIds = new Set(
    config.sets
      .filter((s) => s.tripId && s.id !== activeSet?.id)
      .map((s) => s.tripId as string),
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Invoice terms &amp; conditions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set default terms for all trips, or create trip-specific terms
            (e.g. Mozambique). Each invoice uses the terms linked to its trip.
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
          {/* Carousel header */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous terms set"
              disabled={busy || currentIndex === 0}
              onClick={() => goToSlide(currentIndex - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-sm font-semibold text-foreground">
                {slideLabel(activeSlide, config, trips)}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentIndex + 1} of {totalSlides}
              </p>
              <div className="mt-2 flex justify-center gap-1.5">
                {Array.from({ length: totalSlides }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to terms set ${i + 1}`}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i === currentIndex
                        ? "bg-primary"
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                    onClick={() => goToSlide(i)}
                  />
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next terms set"
              disabled={busy || currentIndex >= totalSlides - 1}
              onClick={() => goToSlide(currentIndex + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {activeSlide.kind === "set" && activeSet ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">
                  Label
                </span>
                <input
                  type="text"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={activeSet.label}
                  disabled={busy}
                  placeholder="e.g. Mozambique terms"
                  onChange={(e) => updateActiveSet({ label: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">
                  Linked trip
                </span>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={activeSet.tripId ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    updateActiveSet({
                      tripId: e.target.value || null,
                      label:
                        activeSet.label === "New trip terms" && e.target.value
                          ? (trips.find((t) => t.id === e.target.value)
                              ?.destination ?? activeSet.label)
                          : activeSet.label,
                    })
                  }
                >
                  <option value="">Choose a trip…</option>
                  {trips.map((trip) => (
                    <option
                      key={trip.id}
                      value={trip.id}
                      disabled={usedTripIds.has(trip.id)}
                    >
                      {trip.name} — {trip.destination} ({trip.departureDate})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Default terms apply to any trip without its own terms set.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <InputModeToggle
              mode={inputMode}
              onChange={switchInputMode}
              disabled={busy}
            />
            {activeSlide.kind === "set" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 text-destructive hover:bg-red-50"
                onClick={removeActiveSet}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4" />
                Remove set
              </Button>
            ) : null}
          </div>

          {inputMode === "lines" ? (
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
          ) : (
            <div className="mt-5">
              <textarea
                className={`${textareaClassName} min-h-[14rem]`}
                value={pasteText}
                rows={12}
                placeholder="Paste your full terms and conditions here — each line becomes one numbered term."
                disabled={busy}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Each non-empty line becomes a separate numbered term on the
                invoice.
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {inputMode === "lines" ? (
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
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={addTripSet}
              disabled={busy}
            >
              <Plus className="h-4 w-4" />
              Add trip terms
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
