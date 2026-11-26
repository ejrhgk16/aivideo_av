import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  readSessionToken,
} from "@/lib/session";

export type Operator = { uuid: string; loginId: string; displayName: string | null };

/** The admin is reachable through a link, so the dev seed's admin/admin must not open it. */
export const MIN_OPERATOR_PASSWORD_LENGTH = 12;

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must be set to at least 32 characters.");
  }
  return secret;
}

/** Re-reads the user on every request, so a suspended or demoted operator loses access at once. */
export async function getOperator(): Promise<Operator | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const uuid = readSessionToken(token, sessionSecret(), Date.now());
  if (!uuid) return null;
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT uuid, login_id AS loginId, display_name AS displayName FROM users WHERE uuid = ? AND account_type = 'OPERATOR' AND status = 'ACTIVE'",
    [uuid],
  );
  return (rows[0] as Operator | undefined) ?? null;
}

/** Call at the top of every admin page and server action. */
export async function requireOperator(): Promise<Operator> {
  const operator = await getOperator();
  if (!operator) redirect("/login");
  return operator;
}

function sameText(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** users.password is stored as plain text in the current development phase (see the users table doc). */
export async function signIn(loginId: string, password: string): Promise<boolean> {
  if (password.length < MIN_OPERATOR_PASSWORD_LENGTH) return false;
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT uuid, password FROM users WHERE login_id = ? AND account_type = 'OPERATOR' AND status = 'ACTIVE'",
    [loginId],
  );
  const user = rows[0];
  if (!user || typeof user.password !== "string" || !sameText(user.password, password)) return false;
  (await cookies()).set(SESSION_COOKIE, createSessionToken(user.uuid, sessionSecret(), Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return true;
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
}
