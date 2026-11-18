import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type UserRow } from "@/db/schema";

export const SESSION_COOKIE = "bookwise_session";
const SESSION_SECONDS = 30 * 24 * 60 * 60;
export type PublicUser = Pick<UserRow, "id" | "username" | "isAdmin">;
export const usernameKey = (name: string) => name.trim().toLowerCase();
export const configuredOwner = () => usernameKey(process.env.ADMIN_NAME || "");
export function isConfiguredOwner(name: string) {
  const owner = configuredOwner();
  return Boolean(owner) && usernameKey(name) === owner;
}
export function hashValue(value: string, salt = crypto.randomBytes(16).toString("hex")) {
  return `${salt}:${crypto.scryptSync(value, salt, 64).toString("hex")}`;
}
export function verifyHash(value: string, stored: string) {
  const [salt, digest] = (stored || "").split(":");
  if (!salt || !/^[a-f\d]{128}$/i.test(digest || "")) return false;
  return crypto.timingSafeEqual(crypto.scryptSync(value, salt, 64), Buffer.from(digest, "hex"));
}
export const newToken = () => crypto.randomBytes(32).toString("hex");
export function isAdminUser(user: Pick<UserRow, "username" | "isAdmin">) {
  return user.isAdmin || isConfiguredOwner(user.username);
}

// Reconcile an existing identity only after its credentials or session have been verified.
// Never infer a role from a username supplied in an import request.
export async function reconcileVerifiedUser<T extends PublicUser>(user: T): Promise<T> {
  if (user.isAdmin || !isConfiguredOwner(user.username)) return user;
  await db.update(users).set({ isAdmin: true }).where(eq(users.id, user.id));
  return { ...user, isAdmin: true };
}
export async function hasAnyAdmin() {
  const owner = configuredOwner();
  const rows = await db.select({ id: users.id }).from(users).where(owner
    ? sql`${users.isAdmin} = true OR lower(trim(${users.username})) = ${owner}`
    : eq(users.isAdmin, true)).limit(1);
  return rows.length > 0;
}
export function publicUser(user: PublicUser): PublicUser {
  return { id: user.id, username: user.username, isAdmin: isAdminUser(user) };
}
export function extractToken(req: NextRequest) {
  // Embedded hosts can reserve Authorization for their own credentials. An explicit
  // Bookwise session always takes precedence and must pass the same database check.
  const applicationToken = req.headers.get("x-bookwise-session");
  if (applicationToken) return applicationToken.trim();
  const bearer = /^Bearer\s+([a-f\d]{64})$/i.exec((req.headers.get("authorization") || "").trim());
  return bearer?.[1] || req.cookies.get(SESSION_COOKIE)?.value?.trim() || "";
}
export async function userForSessionToken(token: string): Promise<PublicUser | null> {
  if (!/^[a-f\d]{64}$/i.test(token)) return null;
  const [row] = await db.select({ id: users.id, username: users.username, isAdmin: users.isAdmin })
    .from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.createdAt, new Date(Date.now() - SESSION_SECONDS * 1000)))).limit(1);
  return row ? publicUser(await reconcileVerifiedUser(row)) : null;
}
export async function getUserFromRequest(req: NextRequest) {
  const token = extractToken(req);
  const user = await userForSessionToken(token);
  if (user) return { user, token };

  // An old browser token must not mask a valid HttpOnly session cookie.
  // A *valid* explicit token still takes precedence, including a reader token.
  const cookieToken = req.cookies.get(SESSION_COOKIE)?.value?.trim() || "";
  if (cookieToken && cookieToken !== token) {
    const cookieUser = await userForSessionToken(cookieToken);
    if (cookieUser) return { user: cookieUser, token: cookieToken };
  }
  return null;
}
export function attachSessionCookie(res: NextResponse, token: string) {
  res.headers.set("Cache-Control", "private, no-store");
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
}
export function clearSessionCookie(res: NextResponse) {
  res.headers.set("Cache-Control", "private, no-store");
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}
