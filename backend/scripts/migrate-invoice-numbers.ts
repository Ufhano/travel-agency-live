/**
 * Renumbers legacy / imported invoice numbers (e.g. "IMP-1781636987129-6c033d-2")
 * into clean sequential "INV-0001" values, ordered by payment date.
 *
 * `invoice_number` is globally unique across tenants, so numbering is global:
 * existing well-formed "INV-####" numbers are kept and new numbers continue
 * after the highest one. Safe to re-run (already-clean numbers are skipped).
 *
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

  // Highest existing well-formed INV number across all tenants (global unique).
  const existing = (await sql`
    SELECT invoice_number
    FROM payments
    WHERE invoice_number ~ '^INV-[0-9]+$'
  `) as { invoice_number: string }[];

  let max = 0;
  for (const row of existing) {
    const m = /^INV-(\d+)$/.exec(row.invoice_number.trim());
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }

  // Non-conforming numbers, oldest first, get the next sequential values.
  const toFix = (await sql`
    SELECT id
    FROM payments
    WHERE invoice_number !~ '^INV-[0-9]+$'
    ORDER BY paid_at ASC, id ASC
  `) as { id: string }[];

  for (const { id } of toFix) {
    max += 1;
    const inv = `INV-${String(max).padStart(4, "0")}`;
    await sql`
      UPDATE payments SET invoice_number = ${inv} WHERE id = ${id}
    `;
  }

  console.log(`OK: renumbered ${toFix.length} invoice(s) to INV-#### format.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
