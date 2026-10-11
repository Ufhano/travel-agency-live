import { createHash, randomBytes } from "node:crypto";

import { ensureAuthSchema } from "./auth-schema";
import { hashPassword } from "./password";
import { getPublicSiteUrl } from "./public-config";
import { sendVerificationEmail } from "./send-verification-email";

type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function id(prefix: string): string {
  return `${prefix}-${randomBytes(9).toString("hex")}`;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "workspace"}-${randomBytes(3).toString("hex")}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type RegisterResult =
  | {
      ok: true;
      email: string;
      signedIn: boolean;
      user?: {
        id: string;
        tenantId: string;
        username: string;
        displayName: string;
        role: "admin" | "user";
      };
    }
  | { ok: false; status: number; error: string };

export async function registerAccount(
  sql: SqlExecutor,
  input: { name: string; email: string; password: string },
  requestOrigin?: string,
): Promise<RegisterResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (name.length < 2) {
    return { ok: false, status: 400, error: "Enter your name." };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, status: 400, error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, status: 400, error: "Use a password of at least 8 characters." };
  }

  await ensureAuthSchema(sql);

  const existing = (await sql`
    SELECT id FROM app_users WHERE email = ${email} OR username = ${email} LIMIT 1
  `) as { id: string }[];
  if (existing[0]) {
    return { ok: false, status: 409, error: "An account with that email already exists." };
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const tenantId = id("ten");
  const userId = id("u");

  await sql`
    INSERT INTO tenants (id, name, slug)
    VALUES (${tenantId}, ${name}, ${slugify(name)})
  `;
  await sql`
    INSERT INTO app_users (
      id, tenant_id, username, email, password_hash, display_name, role,
      verification_token_hash, verification_expires_at
    )
    VALUES (
      ${userId}, ${tenantId}, ${email}, ${email}, ${hashPassword(password)}, ${name}, ${"admin"},
      ${tokenHash}, ${expires}
    )
  `;

  const link = `${getPublicSiteUrl(requestOrigin)}/verify?token=${token}`;
  try {
    const sent = await sendVerificationEmail({ to: email, name, link });
    if (sent.mode === "unconfigured") {
      await sql`
        UPDATE app_users
        SET email_verified_at = now(),
            verification_token_hash = NULL,
            verification_expires_at = NULL
        WHERE id = ${userId}
      `;
      return {
        ok: true,
        email,
        signedIn: true,
        user: {
          id: userId,
          tenantId,
          username: email,
          displayName: name,
          role: "admin",
        },
      };
    }
  } catch (error) {
    await sql`DELETE FROM app_users WHERE id = ${userId}`;
    await sql`DELETE FROM tenants WHERE id = ${tenantId}`;
    const message = error instanceof Error ? error.message : "Could not send email.";
    return { ok: false, status: 502, error: `Could not send the verification email. ${message}` };
  }

  return { ok: true, email, signedIn: false };
}

export async function verifyEmailToken(
  sql: SqlExecutor,
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, error: "This verification link is missing a token." };

  await ensureAuthSchema(sql);
  const tokenHash = hashToken(trimmed);
  const rows = (await sql`
    SELECT id, verification_expires_at
    FROM app_users
    WHERE verification_token_hash = ${tokenHash}
    LIMIT 1
  `) as { id: string; verification_expires_at: string | Date | null }[];

  const row = rows[0];
  if (!row) return { ok: false, error: "This verification link is invalid or already used." };

  const expires = row.verification_expires_at
    ? new Date(row.verification_expires_at).getTime()
    : 0;
  if (!expires || expires < Date.now()) {
    return { ok: false, error: "This verification link has expired. Register again." };
  }

  await sql`
    UPDATE app_users
    SET email_verified_at = now(),
        verification_token_hash = NULL,
        verification_expires_at = NULL
    WHERE id = ${row.id}
  `;
  return { ok: true };
}
