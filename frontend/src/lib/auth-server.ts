import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth-config";
import { resolveAuthSecret } from "@/lib/auth-secret-shared";
import { parseSessionToken, type SessionPayload } from "@/lib/session-token";

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  try {
    const secret = await resolveAuthSecret();
    return await parseSessionToken(token, secret);
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
