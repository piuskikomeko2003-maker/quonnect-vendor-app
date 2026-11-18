"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthHero } from "@/components/auth/AuthHero";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { getSessionOnce } from "@/lib/auth-session";
import { usePageTitle } from "@/lib/query";

function LoginPageContent() {
  usePageTitle("Log in · Quonnect Vendor");
  const router = useRouter();
  const params = useSearchParams();
  const error = params.get("error") ?? "";

  useEffect(() => {
    let active = true;
    getSessionOnce()
      .then((session) => {
        if (active && session) router.replace("/home");
      });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="auth-shell">
      <AuthHero
        title="Welcome back"
        subtitle="Log in to run your business and your online stall"
      />
      <LoginForm initialError={error} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-shell"><PageSkeleton rows={3} /></div>}>
      <LoginPageContent />
    </Suspense>
  );
}
