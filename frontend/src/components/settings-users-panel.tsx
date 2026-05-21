"use client";

import * as React from "react";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ListedUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  tenantName: string;
  createdAt: string;
};

export function SettingsUsersPanel() {
  const [users, setUsers] = React.useState<ListedUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({
    username: "",
    password: "",
    workspaceName: "",
    displayName: "",
  });

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      const data = (await res.json()) as { users?: ListedUser[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load users.");
      setUsers(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadUsers();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not create user.");
      setForm({ username: "", password: "", workspaceName: "", displayName: "" });
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create user.");
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(userId: string) {
    if (!confirm("Delete this user and their entire workspace (trips, clients, payments)?")) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not delete user.");
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete user.");
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Create workspace user</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each user gets their own isolated platform — separate trips, clients, and invoices.
        </p>

        <form onSubmit={onCreate} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              placeholder="e.g. jane"
              required
              disabled={creating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              disabled={creating}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="workspaceName">Workspace name</Label>
            <Input
              id="workspaceName"
              value={form.workspaceName}
              onChange={(e) => setForm((f) => ({ ...f, workspaceName: e.target.value }))}
              placeholder="e.g. Cape Town branch"
              required
              disabled={creating}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="displayName">Display name (optional)</Label>
            <Input
              id="displayName"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="Shown in the header"
              disabled={creating}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={creating} className="gap-2">
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Create user & workspace
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">All users</h2>
        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {u.displayName}{" "}
                    <span className="text-muted-foreground">(@{u.username})</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {u.tenantName} · {u.role === "admin" ? "Administrator" : "User"}
                  </p>
                </div>
                {u.role !== "admin" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void onDelete(u.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                ) : (
                  <span className="text-xs font-medium text-teal-700">Protected</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
