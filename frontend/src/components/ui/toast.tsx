"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error";

export type ToastAction = {
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  /** When set, the toast stays until the user picks an option. */
  action?: ToastAction;
};

export type ConfirmOptions = {
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive (default true). */
  destructive?: boolean;
  variant?: ToastVariant;
};

type ToastContextValue = {
  toasts: ToastItem[];
  toast: (message: string, variant?: ToastVariant) => void;
  /** Show a toast with Confirm/Cancel buttons; resolves to the user's choice. */
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const newId = () =>
    `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const toast = React.useCallback(
    (message: string, variant: ToastVariant = "default") => {
      const id = newId();
      setToasts((prev) => [...prev, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const confirm = React.useCallback(
    (message: string, options: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) => {
        const id = newId();
        const finish = (ok: boolean) => {
          dismiss(id);
          resolve(ok);
        };
        setToasts((prev) => [
          ...prev,
          {
            id,
            message,
            variant: options.variant ?? "default",
            action: {
              confirmLabel: options.confirmLabel ?? "Delete",
              cancelLabel: options.cancelLabel ?? "Cancel",
              destructive: options.destructive ?? true,
              onConfirm: () => finish(true),
              onCancel: () => finish(false),
            },
          },
        ]);
      }),
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, confirm, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="no-print pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-sm",
            t.variant === "success" &&
              "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/90 dark:text-emerald-100",
            t.variant === "error" &&
              "border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/20",
            t.variant === "default" &&
              "border-border bg-card/95 text-foreground",
          )}
        >
          <div className="flex-1">
            <p className="leading-snug">{t.message}</p>
            {t.action ? (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium text-white shadow-sm",
                    t.action.destructive
                      ? "bg-destructive hover:bg-destructive/90"
                      : "bg-primary hover:bg-primary/90",
                  )}
                  onClick={() => t.action?.onConfirm()}
                >
                  {t.action.confirmLabel}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
                  onClick={() => t.action?.onCancel()}
                >
                  {t.action.cancelLabel}
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
            onClick={() => (t.action ? t.action.onCancel() : onDismiss(t.id))}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
