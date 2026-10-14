import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f5f5f7] px-4 py-12">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/icons/apple/launchpad.png" alt="" width={64} height={64} className="mx-auto h-16 w-16" />
          <p className="mt-4 text-sm font-semibold tracking-tight text-[#6e6e73]">Travel Agency</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">Sign in</h1>
          <p className="mt-2 text-sm text-[#6e6e73]">
            Use the email you confirmed.
          </p>
        </div>
        <div className="rounded-[22px] border border-black/[0.06] bg-white/90 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-[#f5f5f7]" />}>
            <LoginForm defaultUsername="" />
          </Suspense>
          <p className="mt-6 text-center text-sm text-[#6e6e73]">
            New here?{" "}
            <Link href="/register" className="font-medium text-[#0071e3]">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
