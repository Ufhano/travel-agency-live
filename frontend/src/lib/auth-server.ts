import { cookies } from "next/headers";
import { SESSION_COOKIE, getAuthSecret, isAuthEnabled } from "@/lib/auth-config";
import { parseSessionToken, type SessionPayload } from "@/lib/session-token";

export async function getSession(): Promise<SessionPayload | null> {
  if (!isAuthEnabled()) return null;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return await parseSessionToken(token, getAuthSecret());
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
