import { NextResponse } from "next/server";

import { createPublicCheckout } from "@backend/public-booking";
import { getPublicSiteUrl } from "@backend/public-config";

export const runtime = "nodejs";

type Body = {
  fullName?: unknown;
  phone?: unknown;
  email?: unknown;
  idNumber?: unknown;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const origin = request.headers.get("origin") ?? undefined;
  const base = getPublicSiteUrl(origin);

  const result = await createPublicCheckout({
    fullName: asString(body.fullName),
    phone: asString(body.phone),
    email: asString(body.email),
    idNumber: asString(body.idNumber) || null,
    successUrl: `${base}/book/confirmed`,
    cancelUrl: `${base}/book/cancelled`,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    redirectUrl: result.redirectUrl,
    clientId: result.clientId,
    checkoutId: result.checkoutId,
  });
}
