import { randomBytes } from "node:crypto";

import { bootstrapAdminUser, ensureAuthSchema } from "./auth-schema";
import { hashPassword, verifyPassword } from "./password";
import { normalizeRole, type UserRole } from "./roles";

type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

export type AppUser = {
  id: string;
  tenantId: string;
  username: string;
  displayName: string;
  role: UserRole;
  tenantName: string;
  createdAt: string;
};

function id(prefix: string): string {
  return `${prefix}-${randomBytes(9).toString("hex")}`;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export class EmailNotVerifiedError extends Error {
  constructor() {
    super("Email not verified");
    this.name = "EmailNotVerifiedError";
  }
}

export async function ensureAuthReady(sql: SqlExecutor) {
  return bootstrapAdminUser(sql);
}

export async function authenticateUser(
  sql: SqlExecutor,
  username: string,
  password: string,
): Promise<AppUser | null> {
  await ensureAuthReady(sql);
  const rows = (await sql`
    SELECT u.id, u.tenant_id, u.username, u.password_hash, u.display_name, u.role, u.created_at,
           u.email, u.email_verified_at, t.name AS tenant_name
    FROM app_users u
    JOIN tenants t ON t.id = u.tenant_id
    WHERE u.username = ${username.trim().toLowerCase()}
       OR u.email = ${username.trim().toLowerCase()}
    LIMIT 1
  `) as {
    id: string;
    tenant_id: string;
    username: string;
    password_hash: string;
    display_name: string;
    role: string;
    created_at: string | Date;
    email: string | null;
    email_verified_at: string | Date | null;
    tenant_name: string;
  }[];

  const row = rows[0];
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  if (row.email && !row.email_verified_at) throw new EmailNotVerifiedError();

  return {
    id: row.id,
    tenantId: row.tenant_id,
    username: row.username,
    displayName: row.display_name,
    role: normalizeRole(row.role),
    tenantName: row.tenant_name,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

export async function listUsers(sql: SqlExecutor): Promise<AppUser[]> {
  await ensureAuthSchema(sql);
  const rows = (await sql`
    SELECT u.id, u.tenant_id, u.username, u.display_name, u.role, u.created_at, t.name AS tenant_name
    FROM app_users u
    JOIN tenants t ON t.id = u.tenant_id
    ORDER BY u.created_at ASC
  `) as {
    id: string;
    tenant_id: string;
    username: string;
    display_name: string;
    role: string;
    created_at: string | Date;
    tenant_name: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    username: row.username,
    displayName: row.display_name,
    role: normalizeRole(row.role),
    tenantName: row.tenant_name,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }));
}

export async function updateUserRole(
  sql: SqlExecutor,
  userId: string,
  role: UserRole,
  actingUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (userId === actingUserId) {
    return { ok: false, error: "You cannot change your own role." };
  }

  const nextRole = normalizeRole(role);

  const rows = (await sql`
    SELECT id, role FROM app_users WHERE id = ${userId} LIMIT 1
  `) as { id: string; role: string }[];
  const row = rows[0];
  if (!row) return { ok: false, error: "User not found." };

  const currentRole = normalizeRole(row.role);
  if (currentRole === nextRole) return { ok: true };

  if (currentRole === "admin" && nextRole === "user") {
    const counts = (await sql`
      SELECT COUNT(*)::int AS c FROM app_users WHERE role = 'admin'
    `) as { c: number }[];
    if ((counts[0]?.c ?? 0) <= 1) {
      return { ok: false, error: "At least one superuser must remain." };
    }
  }

  await sql`UPDATE app_users SET role = ${nextRole} WHERE id = ${userId}`;
  return { ok: true };
}

export async function createWorkspaceUser(
  sql: SqlExecutor,
  input: {
    username: string;
    password: string;
    workspaceName: string;
    displayName?: string;
    role?: UserRole;
  },
): Promise<{ ok: true; user: AppUser } | { ok: false; error: string }> {
  await ensureAuthReady(sql);

  const username = input.username.trim().toLowerCase();
  const password = input.password;
  const workspaceName = input.workspaceName.trim();
  const displayName = input.displayName?.trim() || workspaceName;
  const role = normalizeRole(input.role ?? "user");

  if (!username || username.length < 2) {
    return { ok: false, error: "Username must be at least 2 characters." };
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return {
      ok: false,
      error: "Username may only use letters, numbers, dots, underscores, and hyphens.",
    };
  }
  if (!password || password.length < 4) {
    return { ok: false, error: "Password must be at least 4 characters." };
  }
  if (!workspaceName) {
    return { ok: false, error: "Workspace name is required." };
  }

  const taken = (await sql`
    SELECT id FROM app_users WHERE username = ${username} LIMIT 1
  `) as { id: string }[];
  if (taken[0]) {
    return { ok: false, error: "That username is already taken." };
  }

  const tenantId = id("ten");
  const userId = id("u");

  await sql`
    INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, ${workspaceName}, ${slugify(workspaceName)})
  `;
  await sql`
    INSERT INTO app_users (id, tenant_id, username, password_hash, display_name, role)
    VALUES (${userId}, ${tenantId}, ${username}, ${hashPassword(password)}, ${displayName}, ${role})
  `;

  return {
    ok: true,
    user: {
      id: userId,
      tenantId,
      username,
      displayName,
      role,
      tenantName: workspaceName,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function deleteUserById(
  sql: SqlExecutor,
  userId: string,
  actingUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (userId === actingUserId) {
    return { ok: false, error: "You cannot delete your own account." };
  }

  const rows = (await sql`
    SELECT id, tenant_id, role FROM app_users WHERE id = ${userId} LIMIT 1
  `) as { id: string; tenant_id: string; role: string }[];
  const row = rows[0];
  if (!row) return { ok: false, error: "User not found." };
  if (row.role === "admin") {
    return { ok: false, error: "Superuser accounts cannot be deleted." };
  }

  await sql`DELETE FROM payments WHERE tenant_id = ${row.tenant_id}`;
  await sql`DELETE FROM clients WHERE tenant_id = ${row.tenant_id}`;
  await sql`DELETE FROM trips WHERE tenant_id = ${row.tenant_id}`;
  await sql`DELETE FROM app_users WHERE id = ${userId}`;
  await sql`DELETE FROM tenants WHERE id = ${row.tenant_id}`;

  return { ok: true };
}
