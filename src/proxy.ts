import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const AUTH_ROUTES = ["/login", "/signup"];

function redirectWithCookies(request: NextRequest, path: string, response: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isAuthRoute = AUTH_ROUTES.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!user && !isAuthRoute) {
    return redirectWithCookies(request, "/login", response);
  }

  if (user && (isAuthRoute || pathname === "/")) {
    return redirectWithCookies(request, "/home", response);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
