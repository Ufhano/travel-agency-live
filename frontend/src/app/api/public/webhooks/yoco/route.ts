import { NextResponse } from "next/server";

import { fulfillYocoPaymentSucceeded } from "@backend/public-booking";
import { yocoWebhookSecret } from "@backend/public-config";
import {
  verifyYocoWebhook,
  YocoWebhookVerificationError,
} from "@backend/yoco-webhook";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const secret = yocoWebhookSecret();
  if (!secret) {
    console.error("[yoco-webhook] YOCO_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let event;
  try {
    event = verifyYocoWebhook(rawBody, headers, secret);
  } catch (e) {
    const message =
      e instanceof YocoWebhookVerificationError
        ? e.message
        : "Signature verification failed.";
    console.warn("[yoco-webhook] rejected:", message);
    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (event.type === "payment.succeeded") {
    const result = await fulfillYocoPaymentSucceeded(event);
    if (!result.ok) {
      if (result.alert) {
        console.error("[yoco-webhook] ALERT:", result.error, {
          eventId: event.id,
          type: event.type,
        });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } else if (event.type === "payment.failed") {
    console.info("[yoco-webhook] payment.failed", { eventId: event.id });
  } else {
    console.info("[yoco-webhook] unhandled event type", {
      eventId: event.id,
      type: event.type,
    });
  }

  return NextResponse.json({ received: true });
}
