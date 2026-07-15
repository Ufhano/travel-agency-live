/**
 * Re-apply departure dates so trip titles and client balance-due dates
 * pick up the 2025→2026 (etc.) sync fix for already-updated departures.
 *
 * Usage: npx tsx backend/scripts/repair-trip-date-labels.ts [tripId]
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { updateTripInNeon } from "../lib/trip-update";

const envPath = resolve(__dirname, "../../frontend/.env.local");
const env = readFileSync(envPath, "utf8");
const m = env.match(/DATABASE_URL="([^"]+)"/) ?? env.match(/DATABASE_URL=([^\s#]+)/);
const url = (m?.[1] ?? process.env.DATABASE_URL)?.replace(/^"|"$/g, "");
if (!url) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

const sql = neon(url);
const tripIdFilter = process.argv[2]?.trim();

async function main() {
  const rows = (await sql`
    SELECT id, tenant_id, name, destination, departure_date
    FROM trips
    ORDER BY departure_date
  `) as Array<{
    id: string;
    tenant_id: string;
    name: string;
    destination: string;
    departure_date: string | Date;
  }>;

  const targets = tripIdFilter
    ? rows.filter((r) => r.id === tripIdFilter)
    : rows;

  if (targets.length === 0) {
    console.error(tripIdFilter ? `Trip not found: ${tripIdFilter}` : "No trips");
    process.exit(1);
  }

  for (const row of targets) {
    const departureDate =
      typeof row.departure_date === "string"
        ? row.departure_date.slice(0, 10)
        : (() => {
            const d = row.departure_date;
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          })();

    /* Prefer SQL text to avoid timezone shifts when deciding what to sync. */
    const textRows = (await sql`
      SELECT departure_date::text AS d FROM trips WHERE id = ${row.id} LIMIT 1
    `) as Array<{ d: string }>;
    const departureFromText = textRows[0]?.d?.slice(0, 10) ?? departureDate;

    const beforeClients = (await sql`
      SELECT balance_due_date::text AS d, COUNT(*)::int AS c
      FROM clients
      WHERE trip_id = ${row.id} AND tenant_id = ${row.tenant_id}
      GROUP BY balance_due_date
      ORDER BY d
    `) as Array<{ d: string; c: number }>;

    const updated = await updateTripInNeon(sql, row.tenant_id, row.id, {
      departureDate: departureFromText,
    });
    if (!updated) {
      console.log(`SKIP ${row.id} (not found on update)`);
      continue;
    }

    const afterClients = (await sql`
      SELECT balance_due_date::text AS d, COUNT(*)::int AS c
      FROM clients
      WHERE trip_id = ${row.id} AND tenant_id = ${row.tenant_id}
      GROUP BY balance_due_date
      ORDER BY d
    `) as Array<{ d: string; c: number }>;

    const nameChanged = row.name !== updated.name;
    console.log(
      [
        nameChanged ? "FIXED" : "ok   ",
        row.id,
        `| ${row.name} → ${updated.name}`,
        `| departs ${updated.departureDate}`,
        `| due before ${JSON.stringify(beforeClients)} after ${JSON.stringify(afterClients)}`,
      ].join(" "),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
