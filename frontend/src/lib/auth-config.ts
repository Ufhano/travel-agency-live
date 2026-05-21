export const SESSION_COOKIE = "nendila_session";

/** Auth is always on; uses AUTH_SECRET (or a dev fallback locally). */
export function getAuthSecret(): string {
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set in production.");
  }
  return "dev-nendila-auth-secret-change-me";
}

export function isAuthEnabled(): boolean {
  try {
    getAuthSecret();
    return true;
  } catch {
    return false;
  }
}
