import { getSql } from "./db";
import { clients as memoryClients, payments as memoryPayments, trips as memoryTrips } from "./data";

export type DeleteClientsResult =
  | { ok: true; deletedCount: number }
  | { ok: false; error: string; status?: number };

function removeClientsFromMemory(
  predicate: (c: (typeof memoryClients)[0]) => boolean,
): number {
  const ids = new Set(
    memoryClients.filter(predicate).map((c) => c.id),
  );
  if (ids.size === 0) return 0;

  for (let i = memoryClients.length - 1; i >= 0; i--) {
    if (ids.has(memoryClients[i]!.id)) memoryClients.splice(i, 1);
  }
  for (let i = memoryPayments.length - 1; i >= 0; i--) {
    if (ids.has(memoryPayments[i]!.clientId)) memoryPayments.splice(i, 1);
  }
  return ids.size;
}

export async function deleteClientById(clientId: string): Promise<DeleteClientsResult> {
  const id = clientId.trim();
  if (!id) return { ok: false, error: "Client id is required.", status: 400 };

  const sql = getSql();
  if (!sql) {
    const n = removeClientsFromMemory((c) => c.id === id);
    if (n === 0) return { ok: false, error: "Client not found.", status: 404 };
    return { ok: true, deletedCount: n };
  }

  try {
    const rows = (await sql`
      DELETE FROM clients WHERE id = ${id} RETURNING id
    `) as Array<{ id: string }>;
    if (rows.length === 0)
      return { ok: false, error: "Client not found.", status: 404 };
    return { ok: true, deletedCount: rows.length };
  } catch (e) {
    console.error("[deleteClientById]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Delete failed.",
      status: 500,
    };
  }
}

export async function deleteClientsByTripId(tripId: string): Promise<DeleteClientsResult> {
  const id = tripId.trim();
  if (!id) return { ok: false, error: "Trip id is required.", status: 400 };

  const sql = getSql();
  if (!sql) {
    const tripExists = memoryTrips.some((t) => t.id === id);
    if (!tripExists) return { ok: false, error: "Trip not found.", status: 404 };
    const n = removeClientsFromMemory((c) => c.tripId === id);
    return { ok: true, deletedCount: n };
  }

  try {
    const tripRows = (await sql`
      SELECT id FROM trips WHERE id = ${id} LIMIT 1
    `) as Array<{ id: string }>;
    if (tripRows.length === 0)
      return { ok: false, error: "Trip not found.", status: 404 };

    const rows = (await sql`
      DELETE FROM clients WHERE trip_id = ${id} RETURNING id
    `) as Array<{ id: string }>;
    return { ok: true, deletedCount: rows.length };
  } catch (e) {
    console.error("[deleteClientsByTripId]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Delete failed.",
      status: 500,
    };
  }
}

export async function deleteClientsByDestination(
  destination: string,
): Promise<DeleteClientsResult> {
  const dest = destination.trim();
  if (!dest) return { ok: false, error: "Destination is required.", status: 400 };

  const sql = getSql();
  if (!sql) {
    const tripIds = new Set(
      memoryTrips.filter((t) => t.destination === dest).map((t) => t.id),
    );
    if (tripIds.size === 0)
      return { ok: false, error: "No trips found for that destination.", status: 404 };
    const n = removeClientsFromMemory((c) => tripIds.has(c.tripId));
    return { ok: true, deletedCount: n };
  }

  try {
    const rows = (await sql`
      DELETE FROM clients
      WHERE trip_id IN (
        SELECT id FROM trips WHERE destination = ${dest}
      )
      RETURNING id
    `) as Array<{ id: string }>;
    if (rows.length === 0)
      return {
        ok: false,
        error: "No travellers found for that destination.",
        status: 404,
      };
    return { ok: true, deletedCount: rows.length };
  } catch (e) {
    console.error("[deleteClientsByDestination]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Delete failed.",
      status: 500,
    };
  }
}
