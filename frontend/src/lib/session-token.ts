export type UserRole = "admin" | "user";

export type SessionPayload = {
  userId: string;
  tenantId: string;
  role: UserRole;
  username: string;
  displayName: string;
  exp: number;
};

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export function sessionExpiry(): number {
  return Date.now() + SESSION_MS;
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function b64urlEncode(text: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(text, "utf8").toString("base64url");
  }
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(encoded: string): string {
  if (typeof Buffer !== "undefined") {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const pad =
      padded.length % 4 === 0 ? padded : padded + "=".repeat(4 - (padded.length % 4));
    return Buffer.from(pad, "base64").toString("utf8");
  }
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? padded : padded + "=".repeat(4 - (padded.length % 4));
  const binary = atob(pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export async function signSession(
  payload: Omit<SessionPayload, "exp"> & { exp?: number },
  secret: string,
): Promise<string> {
  const full: SessionPayload = { ...payload, exp: payload.exp ?? sessionExpiry() };
  const body = b64urlEncode(JSON.stringify(full));
  const sig = await hmacSha256Hex(body, secret);
  return `${body}.${sig}`;
}

export async function parseSessionToken(
  token: string | undefined,
  secret: string,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;
  const expected = await hmacSha256Hex(body, secret);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body)) as SessionPayload;
    if (
      !payload?.userId ||
      !payload?.tenantId ||
      !payload?.username ||
      !payload?.role ||
      !Number.isFinite(payload.exp) ||
      payload.exp < Date.now()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** Safe to pass from Server Components into client components. */
export type ClientSession = Omit<SessionPayload, "exp">;

export function toClientSession(session: SessionPayload | null): ClientSession | null {
  if (!session) return null;
  return {
    userId: session.userId,
    tenantId: session.tenantId,
    role: session.role,
    username: session.username,
    displayName: session.displayName,
  };
}
