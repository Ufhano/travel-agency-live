import { neon } from "@neondatabase/serverless";

type NeonSql = ReturnType<typeof neon>;

let sql: NeonSql | undefined;

/** Neon `sql` when `DATABASE_URL` is set; otherwise `undefined` (empty local fallback via `data.ts`). */
export function getSql(): NeonSql | undefined {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return undefined;
  if (!sql) sql = neon(url);
  return sql;
}
