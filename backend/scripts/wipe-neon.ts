/**
 * Truncates trips / clients / payments on Neon (CASCADE removes dependent rows).
 * Requires DATABASE_URL in env or frontend/.env.local (same loader as seed used).
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
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL missing (frontend/.env.local or .env.local).");
  process.exit(1);
}

const sql = neon(normalizeDatabaseUrl(url));

async function main() {
  console.log("Truncating payments → clients → trips on Neon …");
  await sql`TRUNCATE payments, clients, trips CASCADE`;
  console.log("Done. Tables are empty.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
