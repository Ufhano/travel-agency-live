/**
 * Creates group booking tables (idempotent).
 * Requires DATABASE_URL in env or frontend/.env.local.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { normalizeDatabaseUrl } from "../lib/db";

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
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

async function main() {
  loadEnvLocal();
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    console.error("DATABASE_URL not set.");
    process.exit(1);
  }
  const sql = neon(normalizeDatabaseUrl(raw));

  await sql`
    CREATE TABLE IF NOT EXISTS group_bookings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
      reference_number TEXT NOT NULL,
      trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
      total_amount INTEGER NOT NULL,
      paid_at DATE NOT NULL DEFAULT (CURRENT_DATE),
      status TEXT NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_group_bookings_ref_tenant
      ON group_bookings (tenant_id, reference_number)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_group_bookings_tenant ON group_bookings (tenant_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_group_bookings_trip ON group_bookings (trip_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS group_booking_passengers (
      id TEXT PRIMARY KEY,
      group_booking_id TEXT NOT NULL REFERENCES group_bookings (id) ON DELETE CASCADE,
      passenger_name TEXT NOT NULL,
      passenger_email TEXT NOT NULL,
      amount INTEGER NOT NULL,
      paid_status TEXT NOT NULL DEFAULT 'unpaid',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_group_booking_passengers_booking
      ON group_booking_passengers (group_booking_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS group_booking_documents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
      group_booking_id TEXT NOT NULL REFERENCES group_bookings (id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'application/pdf',
      file_data BYTEA NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_group_booking_documents_booking
      ON group_booking_documents (group_booking_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_group_booking_documents_tenant
      ON group_booking_documents (tenant_id)
  `;

  // Upgrade path from migration 004 (currency column) → 005 (paid_at).
  await sql`ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS paid_at DATE`;
  await sql`
    UPDATE group_bookings
    SET paid_at = (created_at AT TIME ZONE 'UTC')::date
    WHERE paid_at IS NULL
  `;
  await sql`ALTER TABLE group_bookings DROP COLUMN IF EXISTS currency`;

  await sql`
    ALTER TABLE group_booking_passengers
    ADD COLUMN IF NOT EXISTS package_price INTEGER
  `;
  await sql`
    ALTER TABLE group_booking_passengers
    ADD COLUMN IF NOT EXISTS amount_paid INTEGER NOT NULL DEFAULT 0
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS group_booking_passenger_payments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
      passenger_id TEXT NOT NULL REFERENCES group_booking_passengers (id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      paid_at DATE NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_gb_passenger_payments_passenger
      ON group_booking_passenger_payments (passenger_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_gb_passenger_payments_tenant
      ON group_booking_passenger_payments (tenant_id)
  `;
  await sql`
    ALTER TABLE group_booking_documents
    ADD COLUMN IF NOT EXISTS passenger_payment_id TEXT
    REFERENCES group_booking_passenger_payments (id) ON DELETE CASCADE
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_group_booking_documents_payment
      ON group_booking_documents (passenger_payment_id)
  `;

  console.log("OK: group_bookings tables are ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
