import { NextResponse } from "next/server";
import { deletePaymentById } from "@backend/payment-delete";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { paymentId } = await context.params;
  const result = await deletePaymentById(paymentId, session.tenantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    deletedId: result.deletedId,
    invoiceNumber: result.invoiceNumber,
  });
}
