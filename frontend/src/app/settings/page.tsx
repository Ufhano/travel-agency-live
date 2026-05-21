import { redirect } from "next/navigation";
import { SettingsUsersPanel } from "@/components/settings-users-panel";
import { getSession } from "@/lib/auth-server";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage workspace users. Each account has its own trips, clients, and payment data.
        </p>
      </div>
      <SettingsUsersPanel />
    </div>
  );
}
