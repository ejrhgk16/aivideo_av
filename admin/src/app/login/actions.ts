"use server";

import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";

/** loginId is echoed back so the field keeps it after a failed attempt; the password never is. */
export type LoginState = { loginId: string; error: string | null };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const loginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!loginId || !password) return { loginId, error: "아이디와 비밀번호를 입력해 주세요." };
  // One message for every failed sign-in, so the form never tells whether the id exists.
  if (!(await signIn(loginId, password))) return { loginId, error: "아이디 또는 비밀번호가 맞지 않아요." };
  redirect("/");
}
