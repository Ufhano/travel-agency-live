"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        email?: string;
        signedIn?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not create the account.");
        return;
      }
      if (data.signedIn) {
        router.replace("/");
        router.refresh();
        return;
      }
      setSentTo(data.email ?? email);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-teal-950">
          We sent a verification link to <span className="font-semibold">{sentTo}</span>.
          Open it, then sign in.
        </p>
        <Link href="/login" className="text-sm font-medium text-teal-700 underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-teal-950/80">
          Name
        </Label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600/50" />
          <Input
            id="name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 border-teal-200/80 bg-white/90 pl-10"
            disabled={loading}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-teal-950/80">
          Email
        </Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600/50" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 border-teal-200/80 bg-white/90 pl-10"
            disabled={loading}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-teal-950/80">
          Password
        </Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600/50" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 border-teal-200/80 bg-white/90 pl-10"
            placeholder="At least 8 characters"
            disabled={loading}
            required
            minLength={8}
          />
        </div>
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-600 text-base font-semibold text-white"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating account…
          </>
        ) : (
          "Create account"
        )}
      </Button>
    </form>
  );
}
