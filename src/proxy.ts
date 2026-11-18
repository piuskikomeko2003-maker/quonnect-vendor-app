import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_MARKER_COOKIE, resolveAuthRedirect } from "@/lib/auth-redirect";

/**
 * Optimistic redirects before React renders.
 *
 * `/` used to be a client component that waited for JS, hydration and a
 * Supabase `getSession()` call before deciding where to go. That added a full
 * route hop to every cold start. The cookie only records that a session
 * *might* exist; real validation still happens in the browser and in RLS.
 */
export function proxy(request: NextRequest) {
  const destination = resolveAuthRedirect(
    request.nextUrl.pathname,
    request.cookies.has(AUTH_MARKER_COOKIE),
  );

  if (destination) {
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login/:path*", "/signup/:path*"],
};
