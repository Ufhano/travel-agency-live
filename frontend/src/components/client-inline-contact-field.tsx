"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { patchClient, type ClientPatchPayload } from "@/lib/client-patch";
import { cn } from "@/lib/utils";
import type { Client } from "@backend/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactField = "email" | "idNumber";

const FIELD_CONFIG: Record<
  ContactField,
  {
    label?: string;
    emptyLabel: string;
    editAria: (hasValue: boolean) => string;
    placeholder: string;
    inputType: React.HTMLInputTypeAttribute;
    leadingDot: boolean;
    getValue: (client: Client) => string;
    toPatch: (value: string) => Partial<ClientPatchPayload>;
    validate: (value: string) => string | null;
    valueClassName: string;
  }
> = {
  email: {
    emptyLabel: "Add email",
    editAria: (has) => (has ? "Edit email" : "Add email"),
    placeholder: "thandi@example.com",
    inputType: "email",
    leadingDot: false,
    getValue: (c) => c.email.trim(),
    toPatch: (v) => ({ email: v }),
    validate: (v) =>
      EMAIL_RE.test(v) ? null : "Enter a valid email address.",
    valueClassName: "min-w-0 hover:underline",
  },
  idNumber: {
    label: "ID:",
    emptyLabel: "Add ID number",
    editAria: (has) => (has ? "Edit ID number" : "Add ID number"),
    placeholder: "e.g. 8001015009087",
    inputType: "text",
    leadingDot: true,
    getValue: (c) => c.idNumber?.trim() ?? "",
    toPatch: (v) => ({ idNumber: v || null }),
    validate: () => null,
    valueClassName: "min-w-0 font-medium text-foreground hover:underline",
  },
};

export function ClientInlineContactField({
  client,
  field,
  className,
  variant = "inline",
}: {
  client: Client;
  field: ContactField;
  className?: string;
  variant?: "inline" | "stacked";
}) {
  const router = useRouter();
  const config = FIELD_CONFIG[field];
  const initial = config.getValue(client);
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
    if (trimmed === initial) {
      setEditing(false);
      setError(null);
      return;
    }

    const validationError = config.validate(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await patchClient(client, config.toPatch(trimmed));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
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

  const editLabel = field === "email" ? "Email" : "ID number";

  if (!editing) {
    return (
      <div
        className={cn(
          "group flex min-w-0 items-center gap-1.5 text-sm",
          variant === "inline" && "text-inherit",
          className,
        )}
      >
        {variant === "inline" && config.leadingDot ? (
          <span className="text-muted-foreground" aria-hidden>
            ·
          </span>
        ) : null}
        {config.label ? (
          <span className="text-muted-foreground">{config.label}</span>
        ) : null}
        {initial ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={config.valueClassName}
            title={`Click to edit ${editLabel.toLowerCase()}`}
          >
            {initial}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-primary hover:underline"
          >
            {config.emptyLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          aria-label={config.editAria(Boolean(initial))}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{editLabel}</span>
        <div className="flex min-w-[12rem] flex-1 items-center gap-1">
          <Input
            ref={inputRef}
            type={config.inputType}
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
            className="h-8 max-w-xs text-sm"
            placeholder={config.placeholder}
            aria-label={editLabel}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void commit()}
            className="shrink-0 rounded p-1 text-emerald-700 hover:bg-muted disabled:opacity-50"
            aria-label={`Save ${editLabel.toLowerCase()}`}
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
