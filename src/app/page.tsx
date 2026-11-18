"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { getSessionOnce } from "@/lib/auth-session";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    getSessionOnce()
      .then((session) => {
        if (active) router.replace(session ? "/home" : "/login");
      })
      .catch(() => {
        if (active) router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="auth-shell">
      <PageSkeleton rows={3} />
    </div>
  );
}
