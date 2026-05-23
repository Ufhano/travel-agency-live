import { isAuthEnabled } from "@/lib/auth-config";
import { resolveAuthSecret } from "@/lib/auth-secret-shared";
import { parseSessionToken, type SessionPayload } from "@/lib/session-token";

export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!isAuthEnabled() || !token) return null;
  try {
    const secret = await resolveAuthSecret();
    return parseSessionToken(token, secret);
  } catch {
    return null;
  }
}
