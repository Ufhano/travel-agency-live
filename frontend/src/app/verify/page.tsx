import Link from "next/link";

import { getSql } from "@backend/db";
import { verifyEmailToken } from "@backend/register-account";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token ?? "";
  const sql = getSql();
  const result = !sql
    ? { ok: false as const, error: "Database not configured." }
    : await verifyEmailToken(sql, token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4">
      <div className="w-full max-w-md rounded-[22px] border border-black/[0.06] bg-white p-8 text-center shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <img src="/icons/apple/mail.png" alt="" width={64} height={64} className="mx-auto h-16 w-16" />
        <p className="mt-4 text-sm font-semibold text-[#6e6e73]">Travel Agency</p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
          {result.ok ? "Email confirmed" : "Link not valid"}
        </h1>
        <p className="mt-3 text-sm text-[#6e6e73]">
          {result.ok
            ? "Your account is ready. Sign in with the email and password you chose."
            : result.error}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-[#0071e3]"
        >
          Go to sign in
        </Link>
      </div>
    </div>
  );
}
