export function DbConnectionBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive dark:text-red-200"
    >
      <p className="font-medium">Database unavailable</p>
      <p className="mt-1 text-destructive/90 dark:text-red-200/90">{message}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Showing empty data until the connection works. Check{" "}
        <a href="/api/db-health" className="underline">
          /api/db-health
        </a>
        .
      </p>
    </div>
  );
}
