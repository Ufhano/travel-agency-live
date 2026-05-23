export const SESSION_COOKIE = "nendila_session";

export function isAuthEnabled(): boolean {
  return Boolean(
    process.env.AUTH_SECRET?.trim() || process.env.DATABASE_URL?.trim(),
  );
}
