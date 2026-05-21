import { getAuthSecret, isAuthEnabled } from "@/lib/auth-config";
import { parseSessionToken, type SessionPayload } from "@/lib/session-token";

export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!isAuthEnabled() || !token) return null;
  return parseSessionToken(token, getAuthSecret());
}
