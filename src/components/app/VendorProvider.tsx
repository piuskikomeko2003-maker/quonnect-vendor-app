"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { getVendorContext, type VendorContext } from "@/lib/auth";
import { getSessionOnce } from "@/lib/auth-session";
import { userMessage } from "@/lib/errors";
import { subscribeAppData } from "@/lib/query";

const VendorCtx = createContext<VendorContext | null>(null);

export function useVendor(): VendorContext {
  const context = useContext(VendorCtx);
  if (!context) throw new Error("useVendor must be used inside VendorProvider");
  return context;
}

/**
 * Client-side replacement for the old server guard. It restores the session
 * from localStorage, loads the vendor profile, then exposes it to the app
 * layout and pages. Unauthenticated users are sent to /login.
 */
export function VendorProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [context, setContext] = useState<VendorContext | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function boot() {
      const session = await getSessionOnce();

      if (!session) {
        router.replace("/login");
        return;
      }

      const next = await getVendorContext();
      if (!active) return;
      if (!next) {
        router.replace("/setup");
        return;
      }
      setContext(next);
    }

    boot().catch((cause) => {
      if (!active) return;
      console.error("[auth] could not restore session:", cause);
      setError(userMessage(cause, "Could not open your account. Check your connection and try again."));
    });

    return () => {
      active = false;
    };
  }, [router]);

  // Keep the header, accent colour and month setting fresh after mutations.
  useEffect(() => {
    const unsubscribe = subscribeAppData(() => {
      getVendorContext()
        .then((next) => {
          if (next) setContext(next);
        })
        .catch(() => {
          // Keep the last good context; the page-level loader reports errors.
        });
    });
    return unsubscribe;
  }, []);

  if (error) {
    return (
      <div className="app">
        <main className="app-main">
          <div className="card">
            <b>Could not open your account</b>
            <p className="page-subtitle" style={{ marginTop: 6 }}>
              {error}
            </p>
            <button className="btn" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="app">
        <main className="app-main">
          <PageSkeleton rows={4} />
        </main>
      </div>
    );
  }

  return <VendorCtx.Provider value={context}>{children}</VendorCtx.Provider>;
}
