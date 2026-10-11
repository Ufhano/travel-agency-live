import { NextResponse } from "next/server";

import { getSql } from "@backend/db";
import { registerAccount } from "@backend/register-account";

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

  return NextResponse.json({ ok: true, email: result.email });
}
