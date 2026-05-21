import { NextResponse } from "next/server";
import {
  memoryCreateUser,
  memoryDeleteUser,
  memoryListUsers,
} from "@backend/auth-memory";
import { getSql } from "@backend/db";
import {
  createWorkspaceUser,
  deleteUserById,
  listUsers,
} from "@backend/users";
import { getSession } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: {
    username?: string;
    password?: string;
    workspaceName?: string;
    displayName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sql = getSql();
  const result = sql
    ? await createWorkspaceUser(sql, {
        username: body.username ?? "",
        password: body.password ?? "",
        workspaceName: body.workspaceName ?? "",
        displayName: body.displayName,
      })
    : memoryCreateUser({
        username: body.username ?? "",
        password: body.password ?? "",
        workspaceName: body.workspaceName ?? "",
        displayName: body.displayName,
      });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ user: result.user }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("id")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "User id is required." }, { status: 400 });
  }

  const sql = getSql();
  const result = sql
    ? await deleteUserById(sql, userId, session.userId)
    : memoryDeleteUser(userId, session.userId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
