/**
 * Loads `.env.local` if present, then replays bundled demo rows into Neon.
 * Prerequisite: apply `backend/neon/schema.sql` to your branch.
 *
 * Usage: DATABASE_URL=... npm run db:seed
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { trips, clients, payments } from "../lib/data";

function loadEnvLocal() {
  const root = resolve(process.cwd());
  const candidates = [
    resolve(root, ".env.local"),
    resolve(root, "frontend", ".env.local"),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (let line of text.split("\n")) {
      line = line.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("Set DATABASE_URL (e.g. in .env.local) before seeding.");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  console.log("Truncating existing rows…");
  await sql`TRUNCATE payments, clients, trips CASCADE`;

  console.log(`Inserting ${trips.length} trips…`);
  for (const t of trips) {
    await sql`
      INSERT INTO trips (id, name, destination, departure_date, capacity, status, accommodation_note)
      VALUES (
        ${t.id},
        ${t.name},
        ${t.destination},
        ${t.departureDate},
        ${t.capacity},
        ${t.status},
        ${t.accommodationNote}
      )
    `;
  }

  console.log(`Inserting ${clients.length} clients…`);
  for (const c of clients) {
    await sql`
      INSERT INTO clients (id, trip_id, full_name, phone, email, package_price, balance_due_date)
      VALUES (
        ${c.id},
        ${c.tripId},
        ${c.fullName},
        ${c.phone},
        ${c.email},
        ${c.packagePrice},
        ${c.balanceDueDate}
      )
    `;
  }

  console.log(`Inserting ${payments.length} payments…`);
  for (const p of payments) {
    await sql`
      INSERT INTO payments (id, invoice_number, client_id, trip_id, amount, paid_at, method, note)
      VALUES (
        ${p.id},
        ${p.invoiceNumber},
        ${p.clientId},
        ${p.tripId},
        ${p.amount},
        ${p.paidAt},
        ${p.method},
        ${p.note ?? null}
      )
    `;
  }

  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
