import { NextResponse } from "next/server";
import { getSql } from "@backend/db";

/** Quick check that `DATABASE_URL` works (returns 200 `{ ok: true }` when `SELECT 1` succeeds). */
export async function GET() {
  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      {
        ok: false,
        mode: "static",
        message: "DATABASE_URL not set — app uses bundled demo data.",
      },
      { status: 200 },
    );
  }
  try {
    await sql`SELECT 1 AS ok`;
    return NextResponse.json({ ok: true, mode: "neon" }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, mode: "neon", message },
      { status: 503 },
    );
  }
}
