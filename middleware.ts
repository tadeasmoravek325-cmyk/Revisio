import { NextRequest, NextResponse } from "next/server";

const publicRoutes = new Set(["/login", "/signup"]);

function isAssetOrSystemPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.includes(".")
  );
}

function hasSupabaseSession(request: NextRequest) {
  const sessionCookie = request.cookies
    .getAll()
    .find((cookie) => cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token"));

  if (!sessionCookie?.value) {
    return false;
  }

  try {
    const session = JSON.parse(decodeURIComponent(sessionCookie.value));
    const expiresAt = Number(session.expires_at ?? 0);

    if (!session.access_token) {
      return false;
    }

    return !expiresAt || expiresAt * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAssetOrSystemPath(pathname)) {
    return NextResponse.next();
  }

  const isPublicRoute = publicRoutes.has(pathname);
  const authenticated = hasSupabaseSession(request);

  if (!authenticated && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (authenticated && isPublicRoute) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/";
    appUrl.search = "";
    return NextResponse.redirect(appUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"]
};
