"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";

import { Field } from "@/components/ui";
import ui from "@/components/ui.module.css";
import { login, type LoginState } from "./actions";
import styles from "./login.module.css";

const initialState: LoginState = { loginId: "", error: null };

function validate(loginId: string, password: string) {
  const errors: { loginId?: string; password?: string } = {};
  if (!loginId.trim()) errors.loginId = "아이디를 입력해 주세요.";
  if (!password) errors.password = "비밀번호를 입력해 주세요.";
  return errors;
}

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);
  // Seeded from the action state so the id also survives a failed attempt posted without JavaScript.
  const [loginId, setLoginId] = useState(state.loginId);
  const [password, setPassword] = useState("");
  const [attempted, setAttempted] = useState(false);
  const loginIdInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const errors = attempted ? validate(loginId, password) : {};

  // Runs before React calls the action; preventDefault keeps an invalid form from reaching the server.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    setAttempted(true);
    const next = validate(loginId, password);
    if (next.loginId || next.password) {
      event.preventDefault();
      (next.loginId ? loginIdInput : passwordInput).current?.focus();
    }
  };

  return (
    <form action={formAction} onSubmit={submit} noValidate className={styles.form}>
      <Field label="아이디" htmlFor="loginId" error={errors.loginId}>
        <input
          ref={loginIdInput}
          id="loginId"
          name="loginId"
          value={loginId}
          onChange={(event) => setLoginId(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          required
          aria-invalid={errors.loginId ? true : undefined}
          className={ui.input}
        />
      </Field>
      <Field label="비밀번호" htmlFor="password" error={errors.password}>
        <input
          ref={passwordInput}
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          aria-invalid={errors.password ? true : undefined}
          className={ui.input}
        />
      </Field>
      {state.error ? <p role="alert" className={ui.error}>{state.error}</p> : null}
      <button type="submit" disabled={isPending} className={ui.button}>
        {isPending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
