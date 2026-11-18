"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthHero } from "@/components/auth/AuthHero";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { getSetupStatus, type SetupStatus } from "@/lib/setup-status";
import { usePageTitle } from "@/lib/query";

export default function SetupPage() {
  usePageTitle("Finish setup · Quonnect Vendor");
  const router = useRouter();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    getSetupStatus()
      .then((next) => {
        if (!active) return;
        if (!next) {
          router.replace("/login");
          return;
        }
        if (next.repaired) {
          router.replace("/home");
          return;
        }
        setStatus(next);
        setChecked(true);
      })
      .catch((cause) => {
        console.error("[setup] check failed:", cause);
        if (active) setChecked(true);
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (!checked || !status) {
    return (
      <div className="auth-shell">
        <PageSkeleton rows={3} />
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <AuthHero
        title="Finish your database setup"
        subtitle={
          status.email
            ? `Signed in as ${status.email}, but the vendor profile could not be created.`
            : "Signed in, but the vendor profile could not be created."
        }
      />
      <div className="authbody">
        <div className="card">
          {status.missing.length ? (
            <>
              <p style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                These parts of the schema are still missing:
              </p>
              <ul style={{ margin: "10px 0 0 18px", fontSize: 12.5, lineHeight: 1.8 }}>
                {status.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 12, color: "var(--mut)" }}>
                Apply the migrations, then tap Check again. If you cannot use the Supabase CLI,
                paste <code>supabase/APPLY_ON_DASHBOARD.sql</code> into the Supabase SQL Editor.
              </p>
            </>
          ) : (
            <p style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              The tables are present, but creating the vendor profile was blocked. This is usually
              an RLS policy or a missing migration on <code>vendors</code>.
            </p>
          )}
          {status.repairError ? (
            <div className="ro" style={{ fontSize: 11.5 }}>
              <b>Database says:</b> {status.repairError}
            </div>
          ) : null}
          <Link className="btn" href="/setup" style={{ marginTop: 14 }}>
            Check again
          </Link>
          <div style={{ marginTop: 8 }}>
            <SignOutButton />
          </div>
        </div>
        <div className="card">
          <h3>Apply the schema</h3>
          <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--mut)" }}>
            Recommended:
          </p>
          <pre style={{ fontSize: 11, background: "var(--bg)", padding: 10, borderRadius: 10, overflowX: "auto" }}>
{`npx supabase link --project-ref <ref>
npx supabase db push`}
          </pre>
          <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--mut)", marginTop: 8 }}>
            Dashboard fallback: SQL Editor → paste
            <b> supabase/APPLY_ON_DASHBOARD.sql</b> → Run.
          </p>
        </div>
      </div>
    </div>
  );
}
