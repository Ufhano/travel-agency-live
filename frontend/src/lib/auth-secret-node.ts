import { createHmac } from "crypto";
import { resolveAuthSecret } from "@/lib/auth-secret-shared";

const FALLBACK_KEY = "nendila-session-v1";

/** Node-only sync wrapper for API routes. */
export function getAuthSecretForNode(): string {
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const dbUrl = process.env.DATABASE_URL?.trim();
  if (dbUrl) {
    return createHmac("sha256", FALLBACK_KEY).update(dbUrl).digest("hex");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Set AUTH_SECRET in Vercel environment variables.");
  }

  return "dev-nendila-auth-secret-change-me";
}

export { resolveAuthSecret };
