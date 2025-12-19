// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Public pages that should never require auth
const PUBLIC_PATHS = new Set<string>([
  "/", // landing
  "/login", // login
  // add more public routes as needed, e.g. "/about", "/pricing"
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

  // Skip public/system paths entirely
  if (PUBLIC_PATHS.has(pathname) || isSystemPath(pathname)) {
    return NextResponse.next();
  }

  const isInternalProtected = pathname.startsWith("/protected");
  const isOnboardingPath = ONBOARDING_PATHS.has(pathname);
  const token = await getToken({ req }); // uses NEXTAUTH_SECRET from your NextAuth config

  // If someone visits the internal /protected/* URL directly:
  if (isInternalProtected) {
    const cleanPath = pathname.replace(/^\/protected/, "") || "/";
    if (!token) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("callbackUrl", cleanPath + search); // optional
      return NextResponse.redirect(loginUrl);
    }
    // Authenticated: 301/307 redirect to the clean URL so users never see /protected/*
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = cleanPath;
    return NextResponse.redirect(redirectUrl);
  }

  // For all other non-public paths, require auth
  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("callbackUrl", pathname + search); // optional
    return NextResponse.redirect(loginUrl);
  }

  // ========== ONBOARDING LOGIC ==========
  // If user is authenticated, check onboarding status
  const hasCompletedOnboarding = token.hasCompletedOnboarding;

  // User hasn't completed onboarding
  if (!hasCompletedOnboarding) {
    // If they're already on an onboarding page, allow it
    if (isOnboardingPath) {
      const rewriteUrl = req.nextUrl.clone();
      rewriteUrl.pathname = `/protected${pathname}`;
      return NextResponse.rewrite(rewriteUrl);
    }

    // Otherwise, redirect them to onboarding
    const onboardingUrl = req.nextUrl.clone();
    onboardingUrl.pathname = "/onboarding";
    onboardingUrl.search = ""; // clear any query params
    return NextResponse.redirect(onboardingUrl);
  }

  // User has completed onboarding
  if (hasCompletedOnboarding && isOnboardingPath) {
    // If they try to access onboarding pages, redirect to dashboard
    const dashboardUrl = req.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  // ========== NORMAL FLOW ==========
  // Authenticated and onboarding complete: serve the internal file while keeping the pretty URL
  const rewriteUrl = req.nextUrl.clone();
  rewriteUrl.pathname = `/protected${pathname}`;
  return NextResponse.rewrite(rewriteUrl);
}

// Run on page requests; exclude assets by extension for performance
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)"],
};
