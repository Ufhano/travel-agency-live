import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#eef1f2] px-4 py-12">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-wide text-teal-700">Travel Agency</p>
          <h1 className="mt-2 text-2xl font-semibold text-teal-950">Sign in</h1>
          <p className="mt-2 text-sm text-teal-900/60">
            Use the email you confirmed.
          </p>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white/85 p-8 shadow-xl shadow-teal-900/5">
          <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-teal-50" />}>
            <LoginForm defaultUsername="" />
          </Suspense>
          <p className="mt-6 text-center text-sm text-teal-900/60">
            New here?{" "}
            <Link href="/register" className="font-medium text-teal-700 underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
