import { getTripTenant } from "./tenant-scope";

type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

export async function tripBelongsToTenant(
  sql: SqlExecutor,
  tripId: string,
  tenantId: string,
): Promise<boolean> {
  const rows = (await sql`
    SELECT id FROM trips WHERE id = ${tripId} AND tenant_id = ${tenantId} LIMIT 1
  `) as { id: string }[];
  return Boolean(rows[0]);
}

export function memoryTripBelongsToTenant(
  tripId: string,
  tenantId: string,
): boolean {
  return getTripTenant(tripId) === tenantId;
}
