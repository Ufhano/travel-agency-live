/** Tenant used for the public /book one-pager (single-agency deployment). */
export function getPublicTenantId(): string | null {
  return process.env.PUBLIC_TENANT_ID?.trim() || null;
}

/**
 * Absolute site origin for Yoco redirect URLs, e.g. https://book.example.com
 * Falls back to NEXT_PUBLIC_SITE_URL or http://localhost:3000 in development.
 */
export function getPublicSiteUrl(requestOrigin?: string): string {
  const configured =
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (requestOrigin) return requestOrigin.replace(/\/$/, "");
  return "http://localhost:3000";
}

export function yocoSecretKey(): string | null {
  return process.env.YOCO_SECRET_KEY?.trim() || null;
}

export function yocoWebhookSecret(): string | null {
  return process.env.YOCO_WEBHOOK_SECRET?.trim() || null;
}
