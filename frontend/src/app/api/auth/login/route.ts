import { NextResponse } from "next/server";
import {
  memoryAuthenticate,
  bootstrapMemoryAuth,
} from "@backend/auth-memory";
import { getSql } from "@backend/db";
import { authenticateUser, ensureAuthReady } from "@backend/users";
import { getAuthSecretForNode } from "@/lib/auth-secret-node";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    getAuthSecretForNode();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Auth is not configured.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 },
    );
  }

  try {
    const sql = getSql();
    let user;

    if (sql) {
      await ensureAuthReady(sql);
      user = await authenticateUser(sql, username, password);
    } else {
      bootstrapMemoryAuth();
      user = memoryAuthenticate(username, password);
    }

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 },
      );
    }

    const token = await createSessionToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      username: user.username,
      displayName: user.displayName,
    });

    const res = NextResponse.json({
      ok: true,
      user: {
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        tenantName: user.tenantName,
      },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(7 * 24 * 60 * 60));
    return res;
  } catch (e) {
    console.error("[api/auth/login]", e);
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error:
          "Sign-in failed on the server. Check DATABASE_URL and ADMIN_PASSWORD in Vercel, then run npm run db:reset-admin locally.",
        detail: process.env.NODE_ENV === "development" ? detail : undefined,
      },
      { status: 500 },
    );
  }
}
