"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestPasswordReset, signInAction } from "@/actions/auth";
import { useToast } from "@/components/ui/Toast";

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await signInAction(email, password);
    if (!result.ok) {
      setError(result.error ?? "Could not log in");
      setBusy(false);
      return;
    }
    router.replace("/home");
    router.refresh();
  }

  async function onForgot() {
    const result = await requestPasswordReset(email);
    if (result.ok) toast("Password reset email sent");
    else setError(result.error ?? "Could not send reset email");
  }

  return (
    <div className="authbody">
      <div className="card">
        <form onSubmit={onSubmit}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <div className="err" role="alert">
            {error}
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, gap: 8 }}>
            <button type="button" className="link" onClick={onForgot}>
              Forgot password?
            </button>
            <Link className="link" href="/signup">
              Create new account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
