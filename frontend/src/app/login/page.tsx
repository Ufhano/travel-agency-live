import Image from "next/image";
import { Suspense } from "react";
import { Caveat } from "next/font/google";
import { LoginForm } from "@/components/login-form";

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
});

export default function LoginPage() {
  const adminUsername = (process.env.ADMIN_USERNAME?.trim() || "admin").toLowerCase();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#eef1f2] px-4 py-12">
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-gradient-to-br from-teal-300/40 to-cyan-200/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-gradient-to-tl from-teal-400/25 via-cyan-300/20 to-transparent blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-2xl"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-5 h-36 w-full max-w-[320px] sm:h-40">
            <Image
              src="/nendila-brand.png"
              alt="Nendila Travel & Explorers"
              fill
              className="object-contain drop-shadow-md"
              priority
              sizes="320px"
            />
          </div>
          <p
            className={`${caveat.className} text-2xl font-bold tracking-wide text-teal-500 sm:text-3xl`}
          >
            Live, Travel &amp; Explore!
          </p>
          <p className="mt-3 text-sm text-teal-900/55">Operations console sign-in</p>
        </div>

        <div className="rounded-2xl border border-white/80 bg-white/85 p-8 shadow-xl shadow-teal-900/5 backdrop-blur-sm">
          <h1 className="text-center text-lg font-semibold text-teal-950">Welcome back</h1>
          <p className="mt-1 text-center text-sm text-teal-800/60">
            Sign in to your workspace. Admin accounts can create users in Settings.
          </p>
          <p className="mt-3 rounded-lg bg-teal-50/90 px-3 py-2 text-center text-xs text-teal-900/70">
            Admin username: <strong>{adminUsername}</strong> — password is{" "}
            <code className="rounded bg-white/80 px-1">ADMIN_PASSWORD</code> in{" "}
            <code className="rounded bg-white/80 px-1">.env.local</code> (default{" "}
            <strong>admin</strong>)
          </p>
          <div className="mt-6">
            <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-teal-50" />}>
              <LoginForm defaultUsername={adminUsername} />
            </Suspense>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-teal-900/40">
          Nendila Travel &amp; Explorers · Internal use only
        </p>
      </div>
    </div>
  );
}
