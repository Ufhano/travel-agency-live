const FALLBACK_KEY = "travel-agency-session-v1";

async function hmacSha256Hex(message: string, keyMaterial: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Same secret on Node login and Edge middleware when AUTH_SECRET is unset. */
export async function resolveAuthSecret(): Promise<string> {
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const dbUrl = process.env.DATABASE_URL?.trim();
  if (dbUrl) {
    return hmacSha256Hex(dbUrl, FALLBACK_KEY);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Set AUTH_SECRET in Vercel environment variables.");
  }

  return "dev-travel-agency-auth-secret-change-me";
}
