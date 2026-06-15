import { signSession } from "@/lib/session-token";
import { SESSION_COOKIE, isAuthEnabled } from "@/lib/auth-config";
import { getAuthSecretForNode } from "@/lib/auth-secret-node";

export { SESSION_COOKIE, isAuthEnabled } from "@/lib/auth-config";

export type { SessionPayload, UserRole } from "@/lib/session-token";
export { isSuperuser, normalizeRole, roleLabel } from "@backend/roles";

export async function createSessionToken(
  payload: Omit<import("@/lib/session-token").SessionPayload, "exp">,
): Promise<string> {
  return signSession(payload, getAuthSecretForNode());
}

export function sessionCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}
