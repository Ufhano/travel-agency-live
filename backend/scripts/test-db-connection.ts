/**
 * Quick Neon connectivity check. Loads frontend/.env.local — never prints secrets.
 * Usage: npx tsx backend/scripts/test-db-connection.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { normalizeDatabaseUrl } from "../lib/db";

function loadEnvLocal() {
  const root = resolve(process.cwd());
  for (const p of [
    resolve(root, "frontend", ".env.local"),
    resolve(root, ".env.local"),
  ]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
    return p;
  }
  return null;
}

async function main() {
  const envFile = loadEnvLocal();
  const raw = process.env.DATABASE_URL?.trim();

  if (!envFile) {
    console.error("No .env.local found in frontend/ or repo root.");
    process.exit(1);
  }
  console.log("Loaded env from:", envFile);

  if (!raw) {
    console.error("DATABASE_URL is missing or empty.");
    process.exit(1);
  }

  let host = "(unknown)";
  try {
    const u = new URL(normalizeDatabaseUrl(raw));
    host = u.hostname;
    console.log("Host:", host);
    console.log(
      "Pooled endpoint:",
      host.includes("-pooler") ? "yes" : "no — use pooled URL from Neon",
    );
  } catch {
    console.error("DATABASE_URL is not a valid URL.");
    process.exit(1);
  }

  try {
    const sql = neon(normalizeDatabaseUrl(raw));
    const rows = await sql`SELECT 1 AS ok`;
    console.log("Connection OK:", rows);
    process.exit(0);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Connection FAILED:", msg);
    if (e instanceof Error && e.cause) {
      console.error("Cause:", e.cause);
    }
    console.error("\nTips:");
    console.error("- Wake/resume the project in https://console.neon.tech");
    console.error("- Use the POOLED connection string (host contains -pooler)");
    console.error("- Remove channel_binding=require from the URL");
    console.error("- Check firewall/VPN if on a restricted network");
    process.exit(1);
  }
}

void main();
