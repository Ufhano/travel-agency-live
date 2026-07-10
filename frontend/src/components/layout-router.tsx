"use client";

import { usePathname } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import type { ClientSession } from "@/lib/session-token";

export function LayoutRouter({
  children,
  authEnabled,
  session,
}: {
  children: React.ReactNode;
  authEnabled: boolean;
  session: ClientSession | null;
}) {
  const pathname = usePathname() ?? "/";
  const isPublic =
    pathname === "/book" ||
    pathname.startsWith("/book/") ||
    pathname.startsWith("/api/public/");

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <AppShell authEnabled={authEnabled} session={session}>
      {children}
    </AppShell>
  );
}
