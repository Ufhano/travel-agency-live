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

/** Update departure and optional return (both YYYY-MM-DD; return null clears it). */
export async function updateTripDates(
  tripId: string,
  departureDate: string,
  returnDate: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = departureDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, error: "Pick a valid departure date." };
  }
  const ret = returnDate?.trim() ?? "";
  if (ret && !/^\d{4}-\d{2}-\d{2}$/.test(ret)) {
    return { ok: false, error: "Pick a valid return date." };
  }
  if (ret && ret < trimmed) {
    return {
      ok: false,
      error: "Return date must be on or after the departure date.",
    };
  }

  const res = await fetch("/api/trips", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: tripId,
      departureDate: trimmed,
      returnDate: ret || null,
    }),
  });
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    return {
      ok: false,
      error: data?.error ?? `Failed to save date (HTTP ${res.status}).`,
    };
  }
  return { ok: true };
}

/** Update the default package price for a departure (whole ZAR, or null to clear). */
export async function updateTripPackagePrice(
  tripId: string,
  packagePrice: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (packagePrice != null && (!Number.isFinite(packagePrice) || packagePrice < 0)) {
    return { ok: false, error: "Package price must be a non-negative number." };
  }

  const res = await fetch("/api/trips", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: tripId,
      packagePrice:
        packagePrice != null && packagePrice > 0
          ? Math.round(packagePrice)
          : null,
    }),
  });
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    return {
      ok: false,
      error: data?.error ?? `Failed to save package price (HTTP ${res.status}).`,
    };
  }
  return { ok: true };
}
