/** Rename departure label (updates trip name + destination for grouping/chart). */
export async function renameTripLabel(
  tripId: string,
  label: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: "Trip name cannot be empty." };

  const res = await fetch("/api/trips", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: tripId,
      name: trimmed,
      destination: trimmed,
    }),
  });
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    return {
      ok: false,
      error: data?.error ?? `Failed to save trip (HTTP ${res.status}).`,
    };
  }
  return { ok: true };
}
