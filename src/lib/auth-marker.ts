import { AUTH_MARKER_COOKIE } from "@/lib/auth-redirect";

/** The marker only needs to survive as long as a typical persisted session. */
const MARKER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function authMarkerCookie(secure: boolean): string {
  return [
    `${AUTH_MARKER_COOKIE}=1`,
    "Path=/",
    `Max-Age=${MARKER_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearAuthMarkerCookie(): string {
  return `${AUTH_MARKER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Cache the fact that a session exists so the next hard load can skip the client hop. */
export function markSignedIn() {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:";
  document.cookie = authMarkerCookie(secure);
}

/** Remove the hint as soon as the session is gone, so the proxy stops redirecting. */
export function markSignedOut() {
  if (typeof document === "undefined") return;
  document.cookie = clearAuthMarkerCookie();
}
