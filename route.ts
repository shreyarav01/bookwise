import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getUserFromRequest, isAdminUser, isConfiguredOwner } from "@/lib/auth";
import { isValidUuid } from "@/lib/books";
import { ensureSeeded } from "@/lib/seed";

export async function GET(req: NextRequest) {
  try {
    await ensureSeeded();
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Please log in first." }, { status: 401 });
    }
    if (!isAdminUser(auth.user)) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const rows = await db
      .select({ id: users.id, username: users.username, isAdmin: users.isAdmin, createdAt: users.createdAt })
      .from(users)
      .orderBy(asc(users.createdAt));

    return NextResponse.json({
      users: rows.map((u) => ({
        id: u.id,
        username: u.username,
        isAdmin: isAdminUser(u),
        isOwner: isConfiguredOwner(u.username),
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json({ error: "Failed to load accounts." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureSeeded();
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Please log in first." }, { status: 401 });
    }
    if (!isAdminUser(auth.user)) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || "").trim();
    const makeAdmin = Boolean(body.isAdmin);

    if (!isValidUuid(userId)) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    if (userId === auth.user.id && !makeAdmin) {
      return NextResponse.json(
        { error: "You cannot remove your own admin access while signed in." },
        { status: 400 }
      );
    }

    const [target] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
    if (target && !makeAdmin && isConfiguredOwner(target.username)) {
      return NextResponse.json({ error: "The configured owner's administrator access cannot be removed here." }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set({ isAdmin: makeAdmin })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: updated.id,
        username: updated.username,
        isAdmin: isAdminUser(updated),
      },
      message: makeAdmin
        ? `Granted Admin access to ${updated.username}.`
        : `Revoked Admin access from ${updated.username}.`,
    });
  } catch (error) {
    console.error("PATCH /api/admin/users error:", error);
    return NextResponse.json({ error: "Failed to update role." }, { status: 500 });
  }
}
