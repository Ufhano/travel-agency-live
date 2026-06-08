import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(__dirname, "../../frontend/.env.local");
const env = readFileSync(envPath, "utf8");
const m = env.match(/DATABASE_URL="([^"]+)"/);
const url = m?.[1] ?? process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  const tenants = await sql`SELECT id, name, slug FROM tenants ORDER BY created_at`;
  const users = await sql`SELECT id, tenant_id, username FROM app_users`;
  const trips = await sql`
    SELECT id, tenant_id, name, destination, departure_date
    FROM trips
    ORDER BY departure_date
  `;
  console.log("TENANTS:", tenants);
  console.log("USERS:", users);
  console.log("TRIP COUNT:", trips.length);
  for (const t of trips) console.log(` - [${t.tenant_id}] ${t.name} | ${t.destination} | ${t.departure_date}`);
}

main().catch(console.error);
