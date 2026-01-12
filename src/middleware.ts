// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Public pages that should never require auth
const PUBLIC_PATHS = new Set<string>([
  "/", // landing
  "/login", // login
]);

// Onboarding paths that require auth but shouldn't check for completed onboarding
const ONBOARDING_PATHS = new Set<string>([
  "/onboarding",
  "/onboarding/create",
  "/onboarding/join",
]);

function isSystemPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") || // keep API & NextAuth untouched
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

  // Skip public paths (based on clean path)
  if (PUBLIC_PATHS.has(cleanPath)) return NextResponse.next();

  const token = await getToken({ req });

  // Require auth for everything non-public
  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("callbackUrl", cleanPath + search);
    return NextResponse.redirect(loginUrl);
  }

  // Onboarding gating checks must use cleanPath (IMPORTANT)
  const isOnboardingPath = ONBOARDING_PATHS.has(cleanPath);
  const hasCompletedOnboarding = token.hasCompletedOnboarding === true;

  // User hasn't completed onboarding: allow onboarding pages; otherwise redirect to onboarding
  if (!hasCompletedOnboarding && !isOnboardingPath) {
    const onboardingUrl = req.nextUrl.clone();
    onboardingUrl.pathname = "/onboarding";
    onboardingUrl.search = "";
    return NextResponse.redirect(onboardingUrl);
  }

  // User completed onboarding: block onboarding pages
  if (hasCompletedOnboarding && isOnboardingPath) {
    const dashboardUrl = req.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  // If request is already internal, let it render (don't redirect)
  if (pathname.startsWith("/protected")) {
    return NextResponse.next();
  }

  // Rewrite clean -> internal
  const rewriteUrl = req.nextUrl.clone();
  rewriteUrl.pathname = `/protected${cleanPath}`;
  return NextResponse.rewrite(rewriteUrl);
}

// Run on page requests; exclude assets by extension for performance
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)"],
};
