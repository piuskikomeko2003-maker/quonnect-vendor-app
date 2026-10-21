import { LoginForm } from "@/components/auth/LoginForm";
import { AuthHero } from "@/components/auth/AuthHero";

export const metadata = { title: "Log in · Quonnect Vendor" };

export default function LoginPage() {
  return (
    <div className="auth-shell">
      <AuthHero
        title="Welcome back"
        subtitle="Log in to run your business and your online stall"
      />
      <LoginForm />
    </div>
  );
}
