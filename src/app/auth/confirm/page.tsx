"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { createClient } from "@/lib/supabase/browser";
import { clearSessionCache } from "@/lib/auth-session";
import { markSignedIn } from "@/lib/auth-marker";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/home";
  return value;
}

function ConfirmContent() {
  const router = useRouter();
  const params = useSearchParams();
  const key = params.toString();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(key);

    async function confirm() {
      const code = query.get("code");
      const tokenHash = query.get("token_hash");
      const type = query.get("type") as EmailOtpType | null;
      const linkError = query.get("error_description") ?? query.get("error");
      const next = safeNext(query.get("next"));
      const supabase = createClient();
      let message: string | null = null;

      if (linkError) {
        message = linkError;
      } else if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        message = result.error?.message ?? null;
      } else if (tokenHash && type) {
        const result = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
        message = result.error?.message ?? null;
      } else {
        message = "This confirmation link is missing its token.";
      }

      if (!active) return;
      if (message) {
        setError(message);
        router.replace(`/login?error=${encodeURIComponent(message)}`);
      } else {
        // The confirmed session is new, so drop any cached "signed out" result
        // and let the next page re-read it from storage.
        clearSessionCache();
        markSignedIn();
        router.replace(next);
      }
    }

    confirm().catch((cause) => {
      if (!active) return;
      const message = cause instanceof Error ? cause.message : "Could not confirm the link";
      setError(message);
      router.replace(`/login?error=${encodeURIComponent(message)}`);
    });

    return () => {
      active = false;
    };
  }, [key, router]);

  return (
    <div className="auth-shell">
      <div className="authbody">
        <div className="card">
          <b>{error ? "Could not confirm this link" : "Signing you in…"}</b>
          {error ? (
            <p className="page-subtitle" style={{ marginTop: 6 }}>
              {error}
            </p>
          ) : (
            <PageSkeleton rows={2} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-shell">
          <PageSkeleton rows={2} />
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
