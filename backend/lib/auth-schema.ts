import { randomBytes } from "node:crypto";

import { hashPassword } from "./password";

type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

function id(prefix: string): string {
  return `${prefix}-${randomBytes(9).toString("hex")}`;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "workspace";
}

export async function ensureAuthSchema(sql: SqlExecutor): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_app_users_tenant ON app_users (tenant_id)`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS verification_token_hash TEXT`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email
    ON app_users (email)
    WHERE email IS NOT NULL
  `;
  await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS tenant_id TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS tenant_id TEXT`;
  await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id TEXT`;
}

export type BootstrapAdmin = {
  userId: string;
  tenantId: string;
  username: string;
};

export async function bootstrapAdminUser(sql: SqlExecutor): Promise<BootstrapAdmin> {
  await ensureAuthSchema(sql);

  const existing = (await sql`
    SELECT id, tenant_id, username FROM app_users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1
  `) as { id: string; tenant_id: string; username: string }[];

  if (existing[0]) {
    const tenantId = existing[0].tenant_id;
    await backfillTenantIds(sql, tenantId);
    return {
      userId: existing[0].id,
      tenantId,
      username: existing[0].username,
    };
  }

  const tenantId = id("ten");
  const userId = id("u");
  const username = (process.env.ADMIN_USERNAME?.trim() || "admin").toLowerCase();
  const password =
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.AUTH_PASSWORD?.trim() ||
    "admin";
  const tenantName = "Admin workspace";

  await sql`
    INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, ${tenantName}, ${slugify(tenantName)})
  `;
  await sql`
    INSERT INTO app_users (id, tenant_id, username, password_hash, display_name, role)
    VALUES (${userId}, ${tenantId}, ${username}, ${hashPassword(password)}, ${"Administrator"}, ${"admin"})
  `;

  await backfillTenantIds(sql, tenantId);

  return { userId, tenantId, username };
}

async function backfillTenantIds(sql: SqlExecutor, tenantId: string): Promise<void> {
  try {
    await sql`UPDATE trips SET tenant_id = ${tenantId} WHERE tenant_id IS NULL`;
  } catch {
    /* trips table may predate tenant_id column on some branches */
  }
  try {
    await sql`UPDATE clients SET tenant_id = ${tenantId} WHERE tenant_id IS NULL`;
  } catch {
    /* ignore */
  }
  try {
    await sql`UPDATE payments SET tenant_id = ${tenantId} WHERE tenant_id IS NULL`;
  } catch {
    /* ignore */
  }
}
