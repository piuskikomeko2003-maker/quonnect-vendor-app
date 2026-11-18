"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestPasswordReset, signInAction } from "@/actions/auth";
import { useToast } from "@/components/ui/Toast";

function errorMessage(cause: unknown) {
  if (cause instanceof Error && cause.message) return cause.message;
  if (typeof cause === "string" && cause) return cause;
  return "Could not reach the server. Check that the tablet is on the same Wi-Fi as the laptop.";
}

export function LoginForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await signInAction(email, password);
      if (!result.ok) {
        console.error("[login] Supabase sign-in failed:", result.error);
        setError(result.error ?? "Could not log in");
        return;
      }
      router.replace("/home");
      router.refresh();
    } catch (cause) {
      console.error("[login] Unexpected sign-in error:", cause);
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function onForgot() {
    setResetting(true);
    setError("");
    try {
      const result = await requestPasswordReset(email);
      if (result.ok) toast("Password reset email sent");
      else {
        console.error("[login] Password reset failed:", result.error);
        setError(result.error ?? "Could not send reset email");
      }
    } catch (cause) {
      console.error("[login] Unexpected password reset error:", cause);
      setError(errorMessage(cause));
    } finally {
      setResetting(false);
    }
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
            <button type="button" className="link" onClick={onForgot} disabled={resetting}>
              {resetting ? "Sending…" : "Forgot password?"}
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
