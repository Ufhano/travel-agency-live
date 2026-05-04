import { neon } from "@neondatabase/serverless";

type NeonSql = ReturnType<typeof neon>;

let sql: NeonSql | undefined;

/** Returns Neon `sql` for `DATABASE_URL`, or `undefined` when not configured (demo falls back to in-memory seed). */
export function getSql(): NeonSql | undefined {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return undefined;
  if (!sql) sql = neon(url);
  return sql;
}
