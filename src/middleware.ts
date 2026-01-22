// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Public pages that should never require auth
const PUBLIC_PATHS = new Set<string>([
  "/", // landing
  "/login", // login
]);

// Onboarding paths that require auth but should be accessible when NOT in a household
const ONBOARDING_PATHS = new Set<string>([
  "/onboarding",
  "/onboarding/create",
  "/onboarding/join",
]);

function isSystemPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/public") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Skip system paths entirely
  if (isSystemPath(pathname)) return NextResponse.next();

  // Normalize: treat /protected/* as its clean URL for gating logic
  const cleanPath = pathname.startsWith("/protected")
    ? pathname.replace(/^\/protected/, "") || "/"
    : pathname;

  // Skip public paths
  if (PUBLIC_PATHS.has(cleanPath)) return NextResponse.next();

  const token = await getToken({ req });

  // Require auth for everything non-public
  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("callbackUrl", cleanPath + search);
    return NextResponse.redirect(loginUrl);
  }

  const isOnboardingPath = ONBOARDING_PATHS.has(cleanPath);
  const inHousehold = !!token.householdId;

  // If NOT in a household: allow onboarding pages; otherwise redirect to onboarding
  if (!inHousehold && !isOnboardingPath) {
    const onboardingUrl = req.nextUrl.clone();
    onboardingUrl.pathname = "/onboarding";
    onboardingUrl.search = "";
    return NextResponse.redirect(onboardingUrl);
  }

  // If IN a household: block onboarding pages
  if (inHousehold && isOnboardingPath) {
    const dashboardUrl = req.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  // If request is already internal, let it render
  if (pathname.startsWith("/protected")) {
    return NextResponse.next();
  }

  // Rewrite clean -> internal
  const rewriteUrl = req.nextUrl.clone();
  rewriteUrl.pathname = `/protected${cleanPath}`;
  return NextResponse.rewrite(rewriteUrl);
}

// Run on page requests; exclude assets by extension
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)"],
};
