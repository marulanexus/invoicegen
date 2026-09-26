import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isClerkConfigured } from "@/lib/env";

/** Routes that never require authentication. */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pricing",
  "/faq",
  "/privacy",
  "/terms",
  "/api/webhooks(.*)",
  "/api/cron(.*)",
  "/api/public(.*)", // public PDF by share token
  "/p/(.*)", // public shareable document view
]);

/**
 * Mobile JSON API. Clerk still parses the bearer token here, but each route
 * enforces auth itself (`withApiAuth`) so clients get a JSON 401 instead of
 * the 404 that `auth.protect()` returns for non-page requests.
 */
const isMobileApiRoute = createRouteMatcher(["/api/v1(.*)"]);

const clerk = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req) && !isMobileApiRoute(req)) {
    await auth.protect();
  }
});

/**
 * When Clerk keys are not yet configured we let every request through so the
 * developer can still browse the public marketing site during initial setup.
 */
export default isClerkConfigured ? clerk : () => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next internals and static files unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
