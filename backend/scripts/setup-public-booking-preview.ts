import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const root = process.cwd();
const envPath = resolve(root, "frontend/.env.local");
const env = readFileSync(envPath, "utf8");
const m = env.match(/DATABASE_URL="([^"]+)"/);
const url = m?.[1]?.replace(/channel_binding=require&?/, "").replace(/&channel_binding=require/, "");
if (!url) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

const TENANT_ID = "ten-2ccff66a7ff2004719";
/** Soonest upcoming Open trip (Apr 2026 Mozambique). */
const FEATURED_TRIP_ID = "t-47f0eb35deba600ab8";
const FALLBACK_PRICE = 7500;

const sql = neon(url);

async function main() {
  const priceRows = (await sql`
    SELECT AVG(package_price)::int AS avg_price
    FROM clients
    WHERE trip_id = ${FEATURED_TRIP_ID}
  `) as Array<{ avg_price: number | null }>;

  const price = priceRows[0]?.avg_price ?? FALLBACK_PRICE;

  await sql`
    UPDATE trips
    SET
      is_featured = (id = ${FEATURED_TRIP_ID}),
      public_package_price = CASE WHEN id = ${FEATURED_TRIP_ID} THEN ${price} ELSE public_package_price END,
      status = 'Open'
    WHERE tenant_id = ${TENANT_ID}
  `;

  let nextEnv = env;
  if (!/PUBLIC_TENANT_ID=/.test(nextEnv)) {
    nextEnv += `\n# Public /book page (no Yoco keys needed to preview)\nPUBLIC_TENANT_ID=${TENANT_ID}\nPUBLIC_SITE_URL=http://localhost:3000\n`;
  }
  writeFileSync(envPath, nextEnv, "utf8");

  const trip = (await sql`
    SELECT name, destination, departure_date, public_package_price, is_featured, status
    FROM trips WHERE id = ${FEATURED_TRIP_ID}
  `) as Array<Record<string, unknown>>;

  console.log("Updated .env.local with PUBLIC_TENANT_ID and PUBLIC_SITE_URL");
  console.log("Featured trip:", trip[0]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
