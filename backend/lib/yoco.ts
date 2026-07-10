import { randomUUID } from "node:crypto";

import { yocoSecretKey } from "./public-config";

const YOCO_CHECKOUTS_URL = "https://payments.yoco.com/api/checkouts";

export type YocoCheckoutMetadata = Record<string, string>;

export type CreateYocoCheckoutInput = {
  amountCents: number;
  successUrl: string;
  cancelUrl: string;
  failureUrl?: string;
  metadata: YocoCheckoutMetadata;
  idempotencyKey?: string;
};

export type YocoCheckoutResponse = {
  id: string;
  redirectUrl: string;
  status: string;
  amount: number;
  currency: string;
};

export async function createYocoCheckout(
  input: CreateYocoCheckoutInput,
): Promise<YocoCheckoutResponse> {
  const secret = yocoSecretKey();
  if (!secret) {
    throw new Error("YOCO_SECRET_KEY is not configured.");
  }
  if (input.amountCents < 200) {
    throw new Error("Yoco minimum charge is R2.00 (200 cents).");
  }

  const body = {
    amount: input.amountCents,
    currency: "ZAR",
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    failureUrl: input.failureUrl ?? input.cancelUrl,
    metadata: input.metadata,
  };

  const res = await fetch(YOCO_CHECKOUTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey ?? randomUUID(),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Yoco returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const detail =
      json && typeof json === "object" && "message" in json
        ? String((json as { message: unknown }).message)
        : text.slice(0, 300);
    throw new Error(`Yoco checkout failed (${res.status}): ${detail}`);
  }

  const data = json as {
    id?: string;
    redirectUrl?: string;
    status?: string;
    amount?: number;
    currency?: string;
  };

  if (!data.id || !data.redirectUrl) {
    throw new Error("Yoco checkout response missing id or redirectUrl.");
  }

  return {
    id: data.id,
    redirectUrl: data.redirectUrl,
    status: data.status ?? "created",
    amount: data.amount ?? input.amountCents,
    currency: data.currency ?? "ZAR",
  };
}

/** Convert whole-ZAR package price to Yoco cents. */
export function zarToCents(zar: number): number {
  return Math.round(zar * 100);
}

/** Convert Yoco cents to whole-ZAR stored in payments.amount. */
export function centsToZar(cents: number): number {
  return Math.round(cents / 100);
}
