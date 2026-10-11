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
    <div className="flex min-h-screen items-center justify-center bg-[#eef1f2] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <p className="text-sm font-semibold text-teal-700">Travel Agency</p>
        <h1 className="mt-2 text-2xl font-semibold text-teal-950">
          {result.ok ? "Email confirmed" : "Link not valid"}
        </h1>
        <p className="mt-3 text-sm text-teal-900/70">
          {result.ok
            ? "Your account is ready. Sign in with the email and password you chose."
            : result.error}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-teal-700 underline"
        >
          Go to sign in
        </Link>
      </div>
    </div>
  );
}
