/** Maps trip id → tenant id for in-memory fallback when Neon is unset. */
export const tripTenantById = new Map<string, string>();

export function setTripTenant(tripId: string, tenantId: string): void {
  tripTenantById.set(tripId, tenantId);
}

export function getTripTenant(tripId: string): string | undefined {
  return tripTenantById.get(tripId);
}
