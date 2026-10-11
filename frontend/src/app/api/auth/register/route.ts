import { NextResponse } from "next/server";

import { getSql } from "@backend/db";
import { registerAccount } from "@backend/register-account";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 },
    );
  }

  let body: { name?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const result = await registerAccount(
    sql,
    {
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
    },
    origin,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.signedIn && result.user) {
    const token = await createSessionToken({
      userId: result.user.id,
      tenantId: result.user.tenantId,
      role: result.user.role,
      username: result.user.username,
      displayName: result.user.displayName,
    });
    const res = NextResponse.json({ ok: true, signedIn: true });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(7 * 24 * 60 * 60));
    return res;
  }

  return NextResponse.json({ ok: true, email: result.email, signedIn: false });
}
