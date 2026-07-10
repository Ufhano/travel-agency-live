import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const envPath = resolve(process.cwd(), "frontend/.env.local");
const env = readFileSync(envPath, "utf8");
const m = env.match(/DATABASE_URL="([^"]+)"/);
const url = m?.[1] ?? process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

const sql = neon(url.replace(/channel_binding=require&?/, "").replace(/&channel_binding=require/, ""));
const tenantId = "ten-2ccff66a7ff2004719";

async function main() {
const rows = await sql`
  SELECT id, name, destination, departure_date, status, is_featured, public_package_price
  FROM trips
  WHERE tenant_id = ${tenantId}
  ORDER BY departure_date
`;

for (const t of rows) {
  console.log(
    `${t.departure_date} | ${t.status} | featured=${t.is_featured} | price=${t.public_package_price ?? "null"} | ${t.id} | ${t.name}`,
  );
}
}

main().catch(console.error);
