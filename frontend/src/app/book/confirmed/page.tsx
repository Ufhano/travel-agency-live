import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function BookConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ checkoutId?: string }>;
}) {
  return (
    <ConfirmedContent searchParams={searchParams} />
  );
}

async function ConfirmedContent({
  searchParams,
}: {
  searchParams: Promise<{ checkoutId?: string }>;
}) {
  const params = await searchParams;
  const checkoutId = params.checkoutId?.trim();

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <Image
        src="/nendila-logo.png"
        alt=""
        width={56}
        height={56}
        className="mx-auto mb-6"
      />
      <h1 className="text-2xl font-bold">Thank you!</h1>
      <p className="mt-3 text-muted-foreground leading-relaxed">
        Your payment is being processed. You&apos;ll receive a confirmation email shortly once
        it&apos;s verified — this page is not the final confirmation.
      </p>
      {checkoutId ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Reference: {checkoutId}
        </p>
      ) : null}
      <Link
        href="/book"
        className="mt-8 inline-block text-sm font-medium text-primary hover:underline"
      >
        Back to trip details
      </Link>
    </div>
  );
}
