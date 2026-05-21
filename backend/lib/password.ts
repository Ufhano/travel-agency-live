import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  try {
    const attempt = scryptSync(password, salt, KEY_LEN);
    const expected = Buffer.from(expectedHex, "hex");
    return (
      attempt.length === expected.length && timingSafeEqual(attempt, expected)
    );
  } catch {
    return false;
  }
}
