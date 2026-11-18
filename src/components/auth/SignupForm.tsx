"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUpAction } from "@/actions/auth";
import { AuthHero } from "@/components/auth/AuthHero";
import { Icon } from "@/components/ui/Icon";
import { BUSINESS_CATEGORIES } from "@/lib/constants";
import { resizeImageFile } from "@/lib/image";
import { useToast } from "@/components/ui/Toast";

const STEPS = ["Your account", "Your business", "Social media"];

function errorMessage(cause: unknown) {
  if (cause instanceof Error && cause.message) return cause.message;
  if (typeof cause === "string" && cause) return cause;
  return "Could not reach the server. Check that the tablet is on the same Wi-Fi as the laptop.";
}

export function SignupForm() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [motto, setMotto] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function validate(current: number) {
    if (current === 1) {
      if (ownerName.trim().length < 2) return "Enter your name";
      if (phone.replace(/\D/g, "").length < 9) return "Enter a valid phone number";
      if (!/^\S+@\S+\.\S+$/.test(email)) return "Enter a valid email";
      if (password.length < 6) return "Password needs at least 6 characters";
      if (password !== confirm) return "Passwords do not match";
    }
    if (current === 2) {
      if (!businessName.trim()) return "Enter your business name";
      if (!category) return "Choose a business category";
      if (!location.trim()) return "Enter your location";
    }
    return "";
  }

  async function next() {
    const message = validate(step);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await signUpAction({
        ownerName,
        phone,
        email,
        password,
        businessName,
        category,
        location,
        motto,
        instagram,
        facebook,
        tiktok,
        whatsapp,
        logoDataUrl,
      });
      if (!result.ok) {
        console.error("[signup] Supabase sign-up failed:", result.error);
        setError(result.error ?? "Could not create your account");
        return;
      }
      if (result.needsConfirmation) {
        setDone(true);
        return;
      }
      toast(`Welcome, ${ownerName.split(/\s+/)[0] || "vendor"}`);
      router.replace("/home");
      router.refresh();
    } catch (cause) {
      console.error("[signup] Unexpected sign-up error:", cause);
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    try {
      const { dataUrl } = await resizeImageFile(file, 256, 0.8, true);
      setLogoDataUrl(dataUrl);
    } catch {
      toast("Could not use that image");
    }
  }

  if (done) {
    return (
      <div className="auth-shell">
        <AuthHero title="Check your inbox" subtitle="One last step to open your stall" />
        <div className="authbody">
          <div className="card center">
            <div className="bigav bigav-sm">
              <Icon name="check" size={32} />
            </div>
            <h2 style={{ fontSize: 18, marginTop: 12 }}>Confirm your email</h2>
            <p style={{ fontSize: 13, color: "var(--mut)", marginTop: 6 }}>
              We sent a confirmation link to <b>{email}</b>. Open it on this tablet and you will
              be signed in automatically — no need to enter your password again.
            </p>
            <p style={{ fontSize: 12, color: "var(--mut)", marginTop: 8 }}>
              If you open the link on another device, come back here and log in.
            </p>
            <Link className="btn" href="/login" style={{ marginTop: 16 }}>
              Go to log in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <AuthHero
        title="Create your vendor account"
        subtitle={`Step ${step} of 3 · ${STEPS[step - 1]}`}
      />
      <div className="authbody">
        <div className="steps" aria-hidden="true">
          {[1, 2, 3].map((number) => (
            <i key={number} className={number <= step ? "on" : ""} />
          ))}
        </div>
        <div className="card">
          {step === 1 ? (
            <>
              <label htmlFor="su-name">Your full name (vendor name)</label>
              <input
                id="su-name"
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
                placeholder="e.g. Amina Nakato"
                autoComplete="name"
              />
              <label htmlFor="su-phone">Phone number</label>
              <input
                id="su-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+256 7XX XXX XXX"
                autoComplete="tel"
              />
              <label htmlFor="su-email">Email</label>
              <input
                id="su-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <label htmlFor="su-password">Password</label>
              <input
                id="su-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
              <label htmlFor="su-confirm">Confirm password</label>
              <input
                id="su-confirm"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="Type it again"
                autoComplete="new-password"
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div style={{ textAlign: "center", margin: "4px 0 6px" }}>
                <label
                  htmlFor="su-logo"
                  style={{
                    display: "inline-block",
                    position: "relative",
                    cursor: "pointer",
                    margin: 0,
                  }}
                >
                  <span className="bigav">
                    {logoDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoDataUrl} alt="Your logo preview" />
                    ) : (
                      <Icon name="camera" size={30} />
                    )}
                  </span>
                  <span className="camb">
                    <Icon name="edit" size={14} />
                  </span>
                </label>
                <input
                  type="file"
                  id="su-logo"
                  accept="image/*"
                  hidden
                  onChange={(event) => onLogo(event.target.files?.[0])}
                />
                <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 6 }}>
                  Add your logo (optional)
                </div>
              </div>
              <label htmlFor="su-business">Business name</label>
              <input
                id="su-business"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="e.g. Amina Fashions"
              />
              <label id="su-category-label">Business category</label>
              <div className="opts" role="group" aria-labelledby="su-category-label">
                {BUSINESS_CATEGORIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`opt ${category === item ? "on" : ""}`}
                    aria-pressed={category === item}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <label htmlFor="su-location">Location</label>
              <input
                id="su-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="e.g. Owino Market, Kampala"
              />
              <label htmlFor="su-motto">Business theme or motto (optional)</label>
              <input
                id="su-motto"
                value={motto}
                onChange={(event) => setMotto(event.target.value)}
                placeholder="e.g. Quality styles, fair prices"
              />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <p style={{ color: "var(--mut)", fontSize: 12 }}>
                All optional. You can add or change these later in your profile.
              </p>
              <label htmlFor="su-instagram">Instagram handle</label>
              <input
                id="su-instagram"
                value={instagram}
                onChange={(event) => setInstagram(event.target.value)}
                placeholder="handle, without @"
              />
              <label htmlFor="su-facebook">Facebook page</label>
              <input
                id="su-facebook"
                value={facebook}
                onChange={(event) => setFacebook(event.target.value)}
                placeholder="page name or username"
              />
              <label htmlFor="su-tiktok">TikTok handle</label>
              <input
                id="su-tiktok"
                value={tiktok}
                onChange={(event) => setTiktok(event.target.value)}
                placeholder="handle, without @"
              />
              <label htmlFor="su-whatsapp">WhatsApp number</label>
              <input
                id="su-whatsapp"
                type="tel"
                value={whatsapp}
                onChange={(event) => setWhatsapp(event.target.value)}
                placeholder="+256 7XX XXX XXX"
              />
            </>
          ) : null}

          <div className="err" role="alert">
            {error}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn ghost"
              onClick={() => (step > 1 ? setStep(step - 1) : router.push("/login"))}
              disabled={busy}
            >
              {step === 1 ? "Cancel" : "Back"}
            </button>
            <button type="button" className="btn" onClick={next} disabled={busy}>
              {busy ? "Creating…" : step === 3 ? "Create account" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
