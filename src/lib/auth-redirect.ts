/**
 * Optimistic auth redirection.
 *
 * Supabase sessions live in localStorage (see `lib/supabase/browser.ts`), so the
 * server cannot see them. The browser mirrors "has a session" into a small
 * first-party cookie so `proxy.ts` can redirect `/` and the auth screens before
 * React downloads and hydrates.
 *
 * The marker is only a UX hint: access control still happens client-side via
 * `getSession()` and Supabase RLS. Never treat the cookie as proof of identity.
 */

export const AUTH_MARKER_COOKIE = "quonnect-auth";

export type AuthRedirect = "/home" | "/login" | null;

/** Where an optimistic server redirect should send this request, if anywhere. */
export function resolveAuthRedirect(
  pathname: string,
  hasSessionMarker: boolean,
): AuthRedirect {
  const normalized = pathname.replace(/\/+$/, "") || "/";

  if (normalized === "/") {
    return hasSessionMarker ? "/home" : "/login";
  }

  if (hasSessionMarker && (normalized === "/login" || normalized === "/signup")) {
    return "/home";
  }

  return null;
}
