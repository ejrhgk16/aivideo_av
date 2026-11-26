import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "admin_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

type SessionPayload = { sub: string; exp: number };

const sign = (body: string, secret: string) =>
  createHmac("sha256", secret).update(body).digest("base64url");

/** Signed `<payload>.<signature>` token that carries the operator's user UUID. */
export function createSessionToken(userUuid: string, secret: string, nowMs: number) {
  const payload: SessionPayload = {
    sub: userUuid,
    exp: Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** Returns the user UUID, or null for a missing, forged, malformed, or expired token. */
export function readSessionToken(
  token: string | undefined,
  secret: string,
  nowMs: number,
): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Partial<SessionPayload>;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    return payload.exp * 1000 > nowMs ? payload.sub : null;
  } catch {
    return null;
  }
}
