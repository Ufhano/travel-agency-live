import { signSession } from "@/lib/session-token";
import { SESSION_COOKIE, getAuthSecret } from "@/lib/auth-config";

export { SESSION_COOKIE, getAuthSecret, isAuthEnabled } from "@/lib/auth-config";

export type { SessionPayload, UserRole } from "@/lib/session-token";

export async function createSessionToken(
  payload: Omit<import("@/lib/session-token").SessionPayload, "exp">,
): Promise<string> {
  return signSession(payload, getAuthSecret());
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
