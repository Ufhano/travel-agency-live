import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SECONDS = 180;
const MAX_BODY_BYTES = 1_048_576;

export type YocoWebhookEvent = {
  id: string;
  type: string;
  createdDate: string;
  payload: Record<string, unknown>;
};

export class YocoWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YocoWebhookVerificationError";
  }
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string {
  const key = Object.keys(headers).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  if (!key) return "";
  const raw = headers[key];
  if (Array.isArray(raw)) return raw[0]?.trim() ?? "";
  return raw?.trim() ?? "";
}

function decodeWebhookSecret(secret: string): Buffer {
  const trimmed = secret.trim();
  if (!trimmed.startsWith("whsec_")) {
    throw new YocoWebhookVerificationError(
      "Webhook secret must start with whsec_.",
    );
  }
  const encoded = trimmed.slice("whsec_".length);
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.length === 0) {
    throw new YocoWebhookVerificationError("Webhook secret is invalid.");
  }
  return decoded;
}

function computeSignature(
  secret: Buffer,
  webhookId: string,
  timestamp: string,
  body: string,
): string {
  const signedPayload = `${webhookId}.${timestamp}.${body}`;
  return createHmac("sha256", secret).update(signedPayload).digest("base64");
}

function signaturesMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Verify a Yoco Standard Webhooks delivery (webhook-id / webhook-timestamp / webhook-signature).
 * Returns the parsed event on success.
 */
export function verifyYocoWebhook(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
): YocoWebhookEvent {
  if (toleranceSeconds < 0 || toleranceSeconds > 3600) {
    throw new YocoWebhookVerificationError("Invalid tolerance window.");
  }
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    throw new YocoWebhookVerificationError("Webhook body too large.");
  }

  const webhookId = headerValue(headers, "webhook-id");
  const timestamp = headerValue(headers, "webhook-timestamp");
  const signatureHeader = headerValue(headers, "webhook-signature");

  if (!webhookId || !timestamp || !signatureHeader) {
    throw new YocoWebhookVerificationError("Missing webhook signature headers.");
  }
  if (!/^\d+$/.test(timestamp)) {
    throw new YocoWebhookVerificationError("Invalid webhook timestamp.");
  }

  const ts = Number.parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSeconds) {
    throw new YocoWebhookVerificationError("Webhook timestamp outside tolerance.");
  }

  const decodedSecret = decodeWebhookSecret(secret);
  const expected = computeSignature(decodedSecret, webhookId, timestamp, rawBody);

  const entries = signatureHeader.split(/\s+/).filter(Boolean);
  const v1Entries = entries
    .filter((e) => e.startsWith("v1,"))
    .map((e) => e.slice(3));

  if (v1Entries.length === 0) {
    throw new YocoWebhookVerificationError("No v1 signature in header.");
  }

  const matched = v1Entries.some((sig) => signaturesMatch(expected, sig));
  if (!matched) {
    throw new YocoWebhookVerificationError("Webhook signature mismatch.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new YocoWebhookVerificationError("Webhook body is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new YocoWebhookVerificationError("Webhook body must be a JSON object.");
  }

  const event = parsed as Record<string, unknown>;
  if (
    typeof event.id !== "string" ||
    typeof event.type !== "string" ||
    typeof event.createdDate !== "string" ||
    !event.payload ||
    typeof event.payload !== "object"
  ) {
    throw new YocoWebhookVerificationError("Webhook event shape is invalid.");
  }

  return {
    id: event.id,
    type: event.type,
    createdDate: event.createdDate,
    payload: event.payload as Record<string, unknown>,
  };
}

export function metadataString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const meta = payload.metadata;
  if (!meta || typeof meta !== "object") return null;
  const value = (meta as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
