/**
 * Adds optional `id_number` column to clients (idempotent).
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
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS id_number TEXT`;
  console.log("OK: clients.id_number column is ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
