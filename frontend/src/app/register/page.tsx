import Link from "next/link";
import { Suspense } from "react";
import { RegisterForm } from "@/components/register-form";

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f5f5f7] px-4 py-12">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/icons/apple/contacts.png" alt="" width={64} height={64} className="mx-auto h-16 w-16" />
          <p className="mt-4 text-sm font-semibold tracking-tight text-[#6e6e73]">Travel Agency</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">Create an account</h1>
          <p className="mt-2 text-sm text-[#6e6e73]">
            We email you a link. Sign in after you confirm it.
          </p>
        </div>
        <div className="rounded-[22px] border border-black/[0.06] bg-white/90 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-[#f5f5f7]" />}>
            <RegisterForm />
          </Suspense>
          <p className="mt-6 text-center text-sm text-[#6e6e73]">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-[#0071e3]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
