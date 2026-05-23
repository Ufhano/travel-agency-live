/**
 * Sets the admin user's password from ADMIN_PASSWORD in frontend/.env.local
 * (creates the admin account if it does not exist yet).
 *
 * Usage: npm run db:reset-admin
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { bootstrapAdminUser } from "../lib/auth-schema";
import { hashPassword } from "../lib/password";

function loadEnvLocal() {
  const root = resolve(process.cwd());
  for (const p of [
    resolve(root, "frontend", ".env.local"),
    resolve(root, ".env.local"),
  ]) {
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

loadEnvLocal();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL missing. Add it to frontend/.env.local");
  process.exit(1);
}

const username = (process.env.ADMIN_USERNAME?.trim() || "admin").toLowerCase();
const password =
  process.env.ADMIN_PASSWORD?.trim() ||
  process.env.AUTH_PASSWORD?.trim() ||
  "admin";

async function main() {
  const sql = neon(url.replace(/^["']|["']$/g, ""));
  await bootstrapAdminUser(sql);

  const rows = (await sql`
    SELECT id FROM app_users WHERE username = ${username} AND role = 'admin' LIMIT 1
  `) as { id: string }[];

  if (!rows[0]) {
    console.error(`No admin user "${username}" found after bootstrap.`);
    process.exit(1);
  }

  await sql`
    UPDATE app_users
    SET password_hash = ${hashPassword(password)}
    WHERE id = ${rows[0].id}
  `;

  console.log(`Admin password updated.`);
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);
  console.log(`Sign in at http://localhost:3000/login`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
