/**
 * Applies a SQL migration file to Neon.
 * Usage: tsx backend/scripts/apply-migration.ts backend/neon/migrations/006_client_discount.sql
 * Requires DATABASE_URL in env or frontend/.env.local.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

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

const file = process.argv[2];
if (!file) {
  console.error("Usage: tsx backend/scripts/apply-migration.ts <path-to-sql>");
  process.exit(1);
}

const sqlPath = resolve(process.cwd(), file);
if (!existsSync(sqlPath)) {
  console.error(`Migration file not found: ${sqlPath}`);
  process.exit(1);
}

const sql = neon(url);

function statementsFrom(text: string): string[] {
  return text
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const statements = statementsFrom(readFileSync(sqlPath, "utf8"));
  console.log(`Applying ${statements.length} statement(s) from ${file} …`);
  for (const stmt of statements) {
    console.log(`  → ${stmt.replace(/\s+/g, " ").slice(0, 80)} …`);
    await sql.query(stmt);
  }
  console.log("Migration applied successfully.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
