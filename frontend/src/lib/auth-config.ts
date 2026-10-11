export const SESSION_COOKIE = "travel_agency_session";

export function isAuthEnabled(): boolean {
  return Boolean(
    process.env.AUTH_SECRET?.trim() || process.env.DATABASE_URL?.trim(),
  );
}
