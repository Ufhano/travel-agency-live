import Image from "next/image";
import Link from "next/link";

export default function BookCancelledPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <Image
        src="/nendila-logo.png"
        alt=""
        width={56}
        height={56}
        className="mx-auto mb-6"
      />
      <h1 className="text-2xl font-bold">Payment cancelled</h1>
      <p className="mt-3 text-muted-foreground leading-relaxed">
        No payment was taken. Your details may still be on hold as a pending reservation — you
        can try again when you&apos;re ready.
      </p>
      <Link
        href="/book"
        className="mt-8 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Try again
      </Link>
    </div>
  );
}
