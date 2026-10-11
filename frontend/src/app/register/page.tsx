import Link from "next/link";
import { Suspense } from "react";
import { RegisterForm } from "@/components/register-form";

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#eef1f2] px-4 py-12">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-wide text-teal-700">Travel Agency</p>
          <h1 className="mt-2 text-2xl font-semibold text-teal-950">Create an account</h1>
          <p className="mt-2 text-sm text-teal-900/60">
            We email you a link. Sign in after you confirm it.
          </p>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white/85 p-8 shadow-xl shadow-teal-900/5">
          <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-teal-50" />}>
            <RegisterForm />
          </Suspense>
          <p className="mt-6 text-center text-sm text-teal-900/60">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-teal-700 underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
