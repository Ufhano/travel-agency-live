"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isSuperuser } from "@backend/roles";
import type { ClientSession } from "@/lib/session-token";

const baseNav = [
  { href: "/", label: "Dashboard", icon: "/icons/apple/launchpad.png" },
  { href: "/clients", label: "Clients", icon: "/icons/apple/contacts.png" },
  { href: "/group-bookings", label: "Group Split", icon: "/icons/apple/messages.png" },
  { href: "/invoices", label: "Invoices", icon: "/icons/apple/numbers.png" },
  { href: "/trips", label: "Trips", icon: "/icons/apple/maps.png" },
];

const superuserNav = [
  { href: "/import", label: "Import", icon: "/icons/apple/folder.png" },
  { href: "/settings", label: "Settings", icon: "/icons/apple/settings.png" },
];

export function AppShell({
  children,
  authEnabled = false,
  session: initialSession = null,
}: {
  children: React.ReactNode;
  authEnabled?: boolean;
  session?: ClientSession | null;
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [session, setSession] = React.useState<ClientSession | null>(initialSession);

  React.useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  React.useEffect(() => {
    if (pathname === "/login" || !authEnabled) return;
    let cancelled = false;
    void fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ClientSession | null) => {
        if (!cancelled && data?.userId) {
          setSession({
            userId: data.userId,
            tenantId: data.tenantId,
            role: data.role,
            username: data.username,
            displayName: data.displayName,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname, authEnabled]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const signedIn = Boolean(session);
  const links = isSuperuser(session?.role)
    ? [...baseNav, ...superuserNav]
    : baseNav;

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
    setSession(null);
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-black/[0.06] bg-white/72 px-3 py-4 backdrop-blur-2xl md:flex">
        <Link href="/" className="px-2.5 pb-4 pt-1">
          <span className="block text-[15px] font-semibold tracking-tight">Travel Agency</span>
          <span className="mt-0.5 block truncate text-[12px] text-[#6e6e73]">
            {session?.displayName ?? "Operations"}
            {" · "}
            {isSuperuser(session?.role) ? "Superuser" : "User"}
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5">
          {links.map((item) => (
            <ShellLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
        {signedIn || authEnabled ? (
          <Button
            type="button"
            variant="ghost"
            className="mt-3 justify-start gap-3 rounded-xl px-2.5 text-[13px] text-[#6e6e73] hover:bg-black/[0.04] hover:text-[#1d1d1f]"
            onClick={() => void signOut()}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        ) : null}
      </aside>

      <nav className="no-print fixed inset-x-3 bottom-3 z-40 flex items-end justify-between gap-1 overflow-x-auto rounded-[22px] border border-white/70 bg-white/75 px-2 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-2xl md:hidden">
        {links.map((item) => (
          <ShellLink key={item.href} item={item} pathname={pathname} compact />
        ))}
        {signedIn || authEnabled ? (
          <button
            type="button"
            onClick={() => void signOut()}
            title="Sign out"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#6e6e73]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : null}
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8 pb-28 md:ml-[232px] md:px-8 md:pb-10">
        {children}
      </main>
    </div>
  );
}

function ShellLink({
  item,
  pathname,
  compact = false,
}: {
  item: { href: string; label: string; icon: string };
  pathname: string;
  compact?: boolean;
}) {
  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      title={item.label}
      className={cn(
        "flex items-center gap-3 rounded-xl text-[13px] font-medium transition-colors",
        compact ? "min-w-0 flex-1 flex-col gap-1 px-1 py-1" : "px-2 py-1.5",
        active ? "bg-black/[0.06]" : "hover:bg-black/[0.04]",
      )}
    >
      <img
        src={item.icon}
        alt=""
        width={32}
        height={32}
        className={cn("shrink-0 object-contain", compact ? "h-7 w-7" : "h-8 w-8")}
      />
      <span className={cn(compact ? "max-w-full truncate text-[10px] leading-none text-[#6e6e73]" : "truncate")}>
        {compact ? item.label.split(" ")[0] : item.label}
      </span>
    </Link>
  );
}
