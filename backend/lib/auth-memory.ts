import { hashPassword, verifyPassword } from "./password";
import type { AppUser } from "./users";

type MemoryUser = AppUser & { passwordHash: string };

const tenants = new Map<string, { id: string; name: string; slug: string }>();
const users = new Map<string, MemoryUser>();
const usersByUsername = new Map<string, string>();

export type BootstrapAdmin = {
  userId: string;
  tenantId: string;
  username: string;
};

let bootstrapped = false;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "workspace"
  );
}

export function bootstrapMemoryAuth(): BootstrapAdmin {
  if (bootstrapped) {
    const admin = [...users.values()].find((u) => u.role === "admin");
    if (admin) {
      return { userId: admin.id, tenantId: admin.tenantId, username: admin.username };
    }
  }

  const tenantId = "ten-memory-admin";
  const userId = "u-memory-admin";
  const username = (process.env.ADMIN_USERNAME?.trim() || "admin").toLowerCase();
  const password =
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.AUTH_PASSWORD?.trim() ||
    "admin";

  tenants.set(tenantId, {
    id: tenantId,
    name: "Admin workspace",
    slug: slugify("Admin workspace"),
  });

  const user: MemoryUser = {
    id: userId,
    tenantId,
    username,
    displayName: "Administrator",
    role: "admin",
    tenantName: "Admin workspace",
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(password),
  };

  users.set(userId, user);
  usersByUsername.set(username, userId);
  bootstrapped = true;

  return { userId, tenantId, username };
}

export function memoryAuthenticate(
  username: string,
  password: string,
): AppUser | null {
  bootstrapMemoryAuth();
  const id = usersByUsername.get(username.trim().toLowerCase());
  if (!id) return null;
  const user = users.get(id);
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  const { passwordHash: _, ...rest } = user;
  return rest;
}

export function memoryListUsers(): AppUser[] {
  bootstrapMemoryAuth();
  return [...users.values()].map(({ passwordHash: _, ...u }) => u);
}

export function memoryCreateUser(input: {
  username: string;
  password: string;
  workspaceName: string;
  displayName?: string;
}): { ok: true; user: AppUser } | { ok: false; error: string } {
  bootstrapMemoryAuth();

  const username = input.username.trim().toLowerCase();
  const workspaceName = input.workspaceName.trim();
  const displayName = input.displayName?.trim() || workspaceName;

  if (!username || username.length < 2) {
    return { ok: false, error: "Username must be at least 2 characters." };
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return {
      ok: false,
      error: "Username may only use letters, numbers, dots, underscores, and hyphens.",
    };
  }
  if (!input.password || input.password.length < 4) {
    return { ok: false, error: "Password must be at least 4 characters." };
  }
  if (!workspaceName) {
    return { ok: false, error: "Workspace name is required." };
  }
  if (usersByUsername.has(username)) {
    return { ok: false, error: "That username is already taken." };
  }

  const tenantId = `ten-${Date.now().toString(36)}`;
  const userId = `u-${Date.now().toString(36)}`;

  tenants.set(tenantId, {
    id: tenantId,
    name: workspaceName,
    slug: slugify(workspaceName),
  });

  const user: MemoryUser = {
    id: userId,
    tenantId,
    username,
    displayName,
    role: "user",
    tenantName: workspaceName,
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(input.password),
  };

  users.set(userId, user);
  usersByUsername.set(username, userId);

  const { passwordHash: _, ...rest } = user;
  return { ok: true, user: rest };
}

export function memoryDeleteUser(
  userId: string,
  actingUserId: string,
): { ok: true } | { ok: false; error: string } {
  if (userId === actingUserId) {
    return { ok: false, error: "You cannot delete your own account." };
  }
  const user = users.get(userId);
  if (!user) return { ok: false, error: "User not found." };
  if (user.role === "admin") {
    return { ok: false, error: "The admin account cannot be deleted." };
  }

  users.delete(userId);
  usersByUsername.delete(user.username);
  tenants.delete(user.tenantId);

  return { ok: true };
}
