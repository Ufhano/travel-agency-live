import type { Client } from "@backend/types";

export type ClientPatchPayload = {
  id: string;
  tripId: string;
  fullName: string;
  phone: string;
  email: string;
  idNumber: string | null;
  packagePrice: number;
  balanceDueDate: string;
};

export function clientToPatchPayload(
  client: Client,
  overrides: Partial<ClientPatchPayload> = {},
): ClientPatchPayload {
  return {
    id: client.id,
    tripId: client.tripId,
    fullName: client.fullName,
    phone: client.phone,
    email: client.email,
    idNumber: client.idNumber ?? null,
    packagePrice: client.packagePrice,
    balanceDueDate: client.balanceDueDate,
    ...overrides,
  };
}

export async function patchClient(
  client: Client,
  overrides: Partial<ClientPatchPayload>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/clients", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(clientToPatchPayload(client, overrides)),
  });
  const data = (await res.json().catch(() => null)) as
    | { error?: string }
    | null;
  if (!res.ok) {
    return { ok: false, error: data?.error ?? `Failed to save (HTTP ${res.status}).` };
  }
  return { ok: true };
}
