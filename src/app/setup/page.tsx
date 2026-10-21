import Link from "next/link";
import { AuthHero } from "@/components/auth/AuthHero";
import { SignOutButton } from "@/components/auth/SignOutButton";

export const metadata = { title: "Finish setup · Quonnect Vendor" };

export default function SetupPage() {
  return (
    <div className="auth-shell">
      <AuthHero
        title="We could not open your stall"
        subtitle="Your account is signed in, but its vendor profile is missing."
      />
      <div className="authbody">
        <div className="card">
          <p style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            This usually means the database migrations have not been applied to this Supabase
            project yet. Run the migrations, then try again. If you are not the project owner,
            send this message to your administrator.
          </p>
          <Link className="btn" href="/home" style={{ marginTop: 14 }}>
            Try again
          </Link>
          <div style={{ marginTop: 8 }}>
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
