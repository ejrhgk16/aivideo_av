import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createSessionToken, readSessionToken, SESSION_TTL_SECONDS } from "@/lib/session";

const SECRET = "test-secret-that-is-long-enough";
const USER = "6f1c2b9e-4d3a-4f6e-9b1a-2c3d4e5f6a7b";
// Not a whole second, so the floor in createSessionToken matters.
const NOW = Date.UTC(2026, 10, 23, 3, 0, 0, 500);
const EXPIRES_AT = (Math.floor(NOW / 1000) + SESSION_TTL_SECONDS) * 1000;

/** A token whose body is any text, signed correctly with SECRET. */
const signed = (text: string) => {
  const body = Buffer.from(text).toString("base64url");
  return `${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
};

describe("session token", () => {
  it("round trips the user uuid until it expires", () => {
    const token = createSessionToken(USER, SECRET, NOW);
    expect(readSessionToken(token, SECRET, NOW)).toBe(USER);
    expect(readSessionToken(token, SECRET, EXPIRES_AT - 1)).toBe(USER);
  });

  it("rejects a token exactly at and after its expiry", () => {
    const token = createSessionToken(USER, SECRET, NOW);
    expect(readSessionToken(token, SECRET, EXPIRES_AT)).toBeNull();
    expect(readSessionToken(token, SECRET, EXPIRES_AT + 1000)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const [body, signature] = createSessionToken(USER, SECRET, NOW).split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    const forged = Buffer.from(JSON.stringify({ ...payload, sub: "someone-else" })).toString("base64url");
    expect(readSessionToken(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const [body, signature] = createSessionToken(USER, SECRET, NOW).split(".");
    const flipped = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    expect(readSessionToken(`${body}.${flipped}`, SECRET, NOW)).toBeNull();
    expect(readSessionToken(`${body}.${signature.slice(1)}`, SECRET, NOW)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = createSessionToken(USER, "another-secret-value", NOW);
    expect(readSessionToken(token, SECRET, NOW)).toBeNull();
  });

  it("rejects malformed and missing tokens", () => {
    for (const token of ["", "a", "a.b.c", undefined]) expect(readSessionToken(token, SECRET, NOW)).toBeNull();
    expect(readSessionToken(signed("not json"), SECRET, NOW)).toBeNull();
    expect(readSessionToken(signed("null"), SECRET, NOW)).toBeNull();
    expect(readSessionToken(signed(JSON.stringify({ sub: 1, exp: EXPIRES_AT / 1000 })), SECRET, NOW)).toBeNull();
    expect(readSessionToken(signed(JSON.stringify({ sub: USER, exp: String(EXPIRES_AT / 1000) })), SECRET, NOW)).toBeNull();
  });
});
