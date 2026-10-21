"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/actions/auth";
import { changePasswordAction, updateProfileAction } from "@/actions/settings";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { BUSINESS_CATEGORIES } from "@/lib/constants";
import { resizeImageFile } from "@/lib/image";
import { uploadLogo } from "@/lib/upload";
import type { ProfileData } from "@/lib/types";
import type { IconKey } from "@/lib/constants";

const SOCIALS: { key: "instagram" | "facebook" | "tiktok" | "whatsapp"; label: string; icon: IconKey }[] = [
  { key: "instagram", label: "Instagram", icon: "instagram" },
  { key: "facebook", label: "Facebook", icon: "facebook" },
  { key: "tiktok", label: "TikTok", icon: "tiktok" },
  { key: "whatsapp", label: "WhatsApp", icon: "whatsapp" },
];

function socialHref(key: string, handle: string) {
  if (!handle) return undefined;
  if (key === "instagram") return `https://instagram.com/${encodeURIComponent(handle)}`;
  if (key === "facebook") return `https://facebook.com/${encodeURIComponent(handle)}`;
  if (key === "tiktok") return `https://tiktok.com/@${encodeURIComponent(handle)}`;
  return `https://wa.me/${handle.replace(/\D/g, "")}`;
}

function socialValue(key: string, handle: string) {
  if (key === "instagram" || key === "tiktok") return `@${handle}`;
  return handle;
}

export function ProfileScreen({ data }: { data: ProfileData }) {
  const router = useRouter();
  const toast = useToast();
  const { vendor, stall } = data;
  const [editing, setEditing] = useState(false);
  const [logoUrl, setLogoUrl] = useState(vendor.logo_url);
  const [pwOpen, setPwOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [ownerName, setOwnerName] = useState(vendor.owner_name ?? "");
  const [businessName, setBusinessName] = useState(vendor.business_name);
  const [phone, setPhone] = useState(vendor.phone ?? "");
  const [phone2, setPhone2] = useState(vendor.phone2 ?? "");
  const [email, setEmail] = useState(vendor.email ?? "");
  const [category, setCategory] = useState(vendor.category ?? "");
  const [location, setLocation] = useState(vendor.region ?? "");
  const [motto, setMotto] = useState(vendor.motto ?? "");
  const [instagram, setInstagram] = useState(vendor.instagram ?? "");
  const [facebook, setFacebook] = useState(vendor.facebook ?? "");
  const [tiktok, setTiktok] = useState(vendor.tiktok ?? "");
  const [whatsapp, setWhatsapp] = useState(vendor.whatsapp ?? "");

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const { blob } = await resizeImageFile(file, 256, 0.8, true);
      const result = await uploadLogo(blob, vendor.id);
      if (result.error || !result.url) {
        toast(result.error ?? "Could not upload logo");
      } else {
        setLogoUrl(result.url);
        if (!editing) {
          await updateProfileAction({
            owner_name: vendor.owner_name ?? "",
            business_name: vendor.business_name,
            phone: vendor.phone ?? "",
            phone2: vendor.phone2 ?? "",
            email: vendor.email ?? "",
            category: vendor.category ?? "",
            location: vendor.region ?? "",
            motto: vendor.motto ?? "",
            instagram: vendor.instagram ?? "",
            facebook: vendor.facebook ?? "",
            tiktok: vendor.tiktok ?? "",
            whatsapp: vendor.whatsapp ?? "",
            logo_url: result.url,
          });
          toast("Logo updated");
          router.refresh();
        }
      }
    } catch {
      toast("Could not use that image");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    const result = await updateProfileAction({
      owner_name: ownerName,
      business_name: businessName,
      phone,
      phone2,
      email,
      category,
      location,
      motto,
      instagram,
      facebook,
      tiktok,
      whatsapp,
      logo_url: logoUrl,
    });
    setBusy(false);
    if (!result.ok) return toast(result.error ?? "Could not save profile");
    setEditing(false);
    toast("Profile updated everywhere");
    router.refresh();
  }

  const displayLogo = editing ? logoUrl : vendor.logo_url;
  const displayBusiness = editing ? businessName : vendor.business_name;
  const displayMotto = editing ? motto : vendor.motto;
  const displayCategory = editing ? category : vendor.category;
  const displayLocation = editing ? location : vendor.region;

  return (
    <>
      <div className="card" style={{ textAlign: "center", padding: "20px 14px" }}>
        <label
          htmlFor="profile-logo"
          style={{ display: "inline-block", position: "relative", cursor: "pointer", margin: 0 }}
        >
          <span className="bigav">
            {displayLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayLogo} alt="Business logo" />
            ) : (
              <span>
                {displayBusiness
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((word) => word[0]?.toUpperCase())
                  .join("") || "Q"}
              </span>
            )}
          </span>
          <span className="camb">
            <Icon name="camera" size={15} />
          </span>
        </label>
        <input
          type="file"
          id="profile-logo"
          accept="image/*"
          hidden
          onChange={(event) => upload(event.target.files?.[0])}
        />
        {uploading ? <div style={{ fontSize: 11, color: "var(--mut)" }}>Uploading…</div> : null}
        <h2 style={{ fontSize: 19, marginTop: 10 }}>{displayBusiness}</h2>
        {displayMotto ? (
          <p style={{ fontSize: 13, color: "var(--mut)", fontStyle: "italic", marginTop: 3 }}>
            &ldquo;{displayMotto}&rdquo;
          </p>
        ) : null}
        {displayCategory ? (
          <div style={{ marginTop: 8 }}>
            <span className="tag">{displayCategory}</span>
          </div>
        ) : null}
        {displayLocation ? (
          <p
            style={{
              fontSize: 12.5,
              color: "var(--mut)",
              marginTop: 8,
              display: "flex",
              gap: 4,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Icon name="pin" size={14} /> {displayLocation}
          </p>
        ) : null}
      </div>

      {!editing ? (
        <>
          <button className="btn" style={{ marginBottom: 12 }} onClick={() => setEditing(true)}>
            <Icon name="edit" size={16} /> Edit profile
          </button>

          <div className="card">
            <h3>Contact</h3>
            <Row icon="user" label="Vendor name" value={vendor.owner_name} />
            <Row
              icon="phone"
              label="Phone"
              value={vendor.phone}
              href={vendor.phone ? `tel:${vendor.phone.replace(/[^\d+]/g, "")}` : undefined}
            />
            <Row
              icon="phone"
              label="Second phone"
              value={vendor.phone2}
              href={vendor.phone2 ? `tel:${vendor.phone2.replace(/[^\d+]/g, "")}` : undefined}
            />
            <Row
              icon="mail"
              label="Email"
              value={vendor.email}
              href={vendor.email ? `mailto:${vendor.email}` : undefined}
            />
          </div>

          <div className="card">
            <h3>Business</h3>
            <Row icon="tag" label="Category" value={vendor.category} />
            <Row icon="pin" label="Location" value={vendor.region} />
            <Row icon="quote" label="Theme / motto" value={vendor.motto} />
          </div>

          <div className="card">
            <h3>Social media</h3>
            {SOCIALS.map((social) => {
              const handle = vendor[social.key];
              return (
                <Row
                  key={social.key}
                  icon={social.icon}
                  label={social.label}
                  value={handle ? socialValue(social.key, handle) : null}
                  href={handle ? socialHref(social.key, handle) : undefined}
                />
              );
            })}
          </div>

          <div className="card">
            <h3>Account</h3>
            <button className="btn ghost" style={{ marginBottom: 8 }} onClick={() => setPwOpen(true)}>
              <Icon name="lock" size={16} /> Change password
            </button>
            <button className="btn out" onClick={() => void signOutAction()}>
              <Icon name="logout" size={16} /> Log out
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="card">
            <h3>Contact</h3>
            <label htmlFor="pf-owner">Vendor name</label>
            <input id="pf-owner" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} />
            <label htmlFor="pf-phone">Phone number</label>
            <input id="pf-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
            <label htmlFor="pf-phone2">Second phone number (optional)</label>
            <input id="pf-phone2" type="tel" value={phone2} onChange={(event) => setPhone2(event.target.value)} />
            <label htmlFor="pf-email">Email</label>
            <input id="pf-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>

          <div className="card">
            <h3>Business</h3>
            <label htmlFor="pf-business">Business name</label>
            <input
              id="pf-business"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
            />
            <label id="pf-category">Business category</label>
            <div className="opts" role="group" aria-labelledby="pf-category">
              {BUSINESS_CATEGORIES.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`opt ${category === item ? "on" : ""}`}
                  aria-pressed={category === item}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <label htmlFor="pf-location">Location</label>
            <input
              id="pf-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. Owino Market, Kampala"
            />
            <label htmlFor="pf-motto">Business theme or motto</label>
            <input
              id="pf-motto"
              value={motto}
              onChange={(event) => setMotto(event.target.value)}
              placeholder="e.g. Quality styles, fair prices"
            />
          </div>

          <div className="card">
            <h3>Social media</h3>
            <label htmlFor="pf-instagram">Instagram handle</label>
            <input
              id="pf-instagram"
              value={instagram}
              onChange={(event) => setInstagram(event.target.value)}
              placeholder="handle, without @"
            />
            <label htmlFor="pf-facebook">Facebook page</label>
            <input
              id="pf-facebook"
              value={facebook}
              onChange={(event) => setFacebook(event.target.value)}
              placeholder="page name or username"
            />
            <label htmlFor="pf-tiktok">TikTok handle</label>
            <input
              id="pf-tiktok"
              value={tiktok}
              onChange={(event) => setTiktok(event.target.value)}
              placeholder="handle, without @"
            />
            <label htmlFor="pf-whatsapp">WhatsApp number</label>
            <input
              id="pf-whatsapp"
              type="tel"
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
              placeholder="+256 7XX XXX XXX"
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </>
      )}

      <ChangePasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} stallName={stall.name} />
    </>
  );
}

function Row({
  icon,
  label,
  value,
  href,
}: {
  icon: IconKey;
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  return (
    <div className="row">
      <div className="emo">
        <Icon name={icon} size={20} />
      </div>
      <div className="grow">
        <small>{label}</small>
        {value ? (
          href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              <b>{value}</b>
            </a>
          ) : (
            <b>{value}</b>
          )
        ) : (
          <b style={{ color: "var(--mut)", fontWeight: 500 }}>Not added</b>
        )}
      </div>
    </div>
  );
}

function ChangePasswordSheet({
  open,
  onClose,
  stallName,
}: {
  open: boolean;
  onClose: () => void;
  stallName: string;
}) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setError("");
    if (next !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    const result = await changePasswordAction(current, next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not update password");
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    onClose();
    toast(`Password updated for ${stallName}`);
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Change password">
      <label htmlFor="pw-current">Current password</label>
      <input
        id="pw-current"
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(event) => setCurrent(event.target.value)}
      />
      <label htmlFor="pw-new">New password</label>
      <input
        id="pw-new"
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(event) => setNext(event.target.value)}
        placeholder="At least 6 characters"
      />
      <label htmlFor="pw-confirm">Confirm new password</label>
      <input
        id="pw-confirm"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
      />
      <div className="err" role="alert">
        {error}
      </div>
      <button className="btn" onClick={save} disabled={busy}>
        {busy ? "Updating…" : "Update password"}
      </button>
    </BottomSheet>
  );
}
