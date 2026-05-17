import { neon } from "@neondatabase/serverless";

type NeonSql = ReturnType<typeof neon>;

let sql: NeonSql | undefined;

/** `channel_binding=require` often breaks Node fetch to Neon on Windows — strip it. */
export function normalizeDatabaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  try {
    const u = new URL(trimmed);
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return trimmed
      .replace(/([?&])channel_binding=require(&|$)/g, "$1")
      .replace(/[?&]$/, "");
  }
}

/** Neon `sql` when `DATABASE_URL` is set; otherwise `undefined` (empty local fallback via `data.ts`). */
export function getSql(): NeonSql | undefined {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return undefined;
  const url = normalizeDatabaseUrl(raw);
  if (!sql) sql = neon(url);
  return sql;
}
