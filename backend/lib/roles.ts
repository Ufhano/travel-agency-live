export type UserRole = "admin" | "user";

/** Superusers (`admin` in the database) can manage users, settings, and imports. */
export function isSuperuser(role: string | undefined | null): boolean {
  return role === "admin";
}

export function normalizeRole(role: string): UserRole {
  return role === "admin" ? "admin" : "user";
}

export function roleLabel(role: UserRole | string): string {
  return isSuperuser(role) ? "Superuser" : "User";
}
