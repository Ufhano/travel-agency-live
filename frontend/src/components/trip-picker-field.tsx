"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type TripPickerOption = {
  id: string;
  name: string;
  destination: string;
  departureDate: string;
};

export function tripPickerLabel(t: TripPickerOption): string {
  return `${t.name} — ${t.destination} (${t.departureDate})`;
}

type TripPickerFieldProps = {
  id: string;
  label: string;
  options: TripPickerOption[];
  value: string;
  onChange: (tripId: string) => void;
  disabled?: boolean;
  /** Hint under the field */
  hint?: string;
};

/**
 * Searchable trip picker: type to filter departures, click a row to assign.
 * (Not a native &lt;select&gt; — works like an editable combobox.)
 */
export function TripPickerField({
  id,
  label,
  options,
  value,
  onChange,
  disabled,
  hint = "Type to filter, then choose a departure from the list.",
}: TripPickerFieldProps) {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const listId = `${id}-listbox`;

  React.useEffect(() => {
    const sel = options.find((o) => o.id === value);
    setSearch(sel ? tripPickerLabel(sel) : "");
  }, [value, options]);

  React.useEffect(() => {
    function onDocPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        const v = valueRef.current;
        const s = options.find((o) => o.id === v);
        setSearch(s ? tripPickerLabel(s) : "");
      }
    }
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [options]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((t) => {
      const hay =
        `${t.name} ${t.destination} ${t.departureDate} ${t.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, search]);

  function pick(t: TripPickerOption) {
    onChange(t.id);
    setSearch(tripPickerLabel(t));
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="text"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder="Search by trip name, destination, or date…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              const s = options.find((o) => o.id === value);
              setSearch(s ? tripPickerLabel(s) : "");
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
        {open && !disabled && options.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-[100] mt-1 max-h-52 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                No matching departures — try another search.
              </li>
            ) : (
              filtered.map((t) => (
                <li key={t.id} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={t.id === value}
                    className={cn(
                      "flex w-full flex-wrap items-baseline gap-x-1 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                      t.id === value && "bg-muted",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(t)}
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="text-muted-foreground">
                      — {t.destination}{" "}
                      <span className="tabular-nums">({t.departureDate})</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
