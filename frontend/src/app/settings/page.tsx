import { redirect } from "next/navigation";
import { isSuperuser } from "@backend/roles";
import { SettingsUsersPanel } from "@/components/settings-users-panel";
import { getSession } from "@/lib/auth-server";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isSuperuser(session.role)) redirect("/");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage users and assign superuser or user roles. Superusers can access everything;
          users work in their own workspace with limited permissions.
        </p>
      </div>
      <SettingsUsersPanel />
    </div>
  );
}
