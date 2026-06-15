import { NextResponse } from "next/server";
import {
  memoryCreateUser,
  memoryDeleteUser,
  memoryListUsers,
  memoryUpdateUserRole,
} from "@backend/auth-memory";
import { getSql } from "@backend/db";
import { isSuperuser, normalizeRole, type UserRole } from "@backend/roles";
import {
  createWorkspaceUser,
  deleteUserById,
  listUsers,
  updateUserRole,
} from "@backend/users";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

function requireSuperuserSession(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return { error: "Unauthorized.", status: 401 as const };
  if (!isSuperuser(session.role)) return { error: "Forbidden.", status: 403 as const };
  return { session };
}

export async function GET() {
  const session = await getSession();
  const gate = requireSuperuserSession(session);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const sql = getSql();
  const users = sql ? await listUsers(sql) : memoryListUsers();

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      tenantName: u.tenantName,
      createdAt: u.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  const gate = requireSuperuserSession(session);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: {
    username?: string;
    password?: string;
    workspaceName?: string;
    displayName?: string;
    role?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sql = getSql();
  const role = normalizeRole(body.role ?? "user");
  const result = sql
    ? await createWorkspaceUser(sql, {
        username: body.username ?? "",
        password: body.password ?? "",
        workspaceName: body.workspaceName ?? "",
        displayName: body.displayName,
        role,
      })
    : memoryCreateUser({
        username: body.username ?? "",
        password: body.password ?? "",
        workspaceName: body.workspaceName ?? "",
        displayName: body.displayName,
        role,
      });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ user: result.user }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  const gate = requireSuperuserSession(session);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: { userId?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "User id is required." }, { status: 400 });
  }

  const role = normalizeRole(body.role ?? "user") as UserRole;
  const sql = getSql();
  const result = sql
    ? await updateUserRole(sql, userId, role, gate.session.userId)
    : memoryUpdateUserRole(userId, role, gate.session.userId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  const gate = requireSuperuserSession(session);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("id")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "User id is required." }, { status: 400 });
  }

  const sql = getSql();
  const result = sql
    ? await deleteUserById(sql, userId, gate.session.userId)
    : memoryDeleteUser(userId, gate.session.userId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
