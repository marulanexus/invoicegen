import "server-only";

import { z } from "zod";

import { getOrgContext, type OrgContext } from "@/server/auth/context";
import type { ServiceErrorCode, ServiceResult } from "@/server/service-result";

/**
 * Shared plumbing for the versioned JSON API (`/api/v1`) used by the mobile app.
 *
 * Contract:
 * - Auth: `Authorization: Bearer <Clerk session token>` is required. Cookie-only
 *   requests are rejected, which also shuts out cross-site (CSRF) calls.
 * - Success: `{ "data": … }`. Failure: `{ "error": { code, message, fieldErrors? } }`.
 */

export type ApiErrorCode =
  | ServiceErrorCode
  | "unauthenticated"
  | "bad_request"
  | "internal";

const STATUS: Record<ServiceErrorCode, number> = {
  validation: 422,
  not_found: 404,
  plan_limit: 403,
  conflict: 409,
  rate_limited: 429,
  upstream: 502,
};

export function apiData<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>
): Response {
  return Response.json(
    { error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } },
    { status }
  );
}

/** Map a service outcome to an HTTP response. */
export function apiResult<T>(res: ServiceResult<T>, successStatus = 200): Response {
  if (res.ok) return apiData(res.data, successStatus);
  return apiError(STATUS[res.code], res.code, res.error, res.fieldErrors);
}

/** Parse a JSON body; `undefined` means the body was missing or not JSON. */
export async function readJson(req: Request): Promise<unknown | undefined> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

const uuid = z.string().uuid();

/** Route ids must be UUIDs; anything else is treated as not found. */
export function isUuid(value: string): boolean {
  return uuid.safeParse(value).success;
}

type RouteArgs<P> = { params: Promise<P> };

/**
 * Wrap a route handler: require a bearer token, resolve the tenant, and turn
 * unexpected errors into a 500 without leaking internals.
 */
export function withApiAuth<P = Record<string, never>>(
  handler: (ctx: OrgContext, req: Request, params: P) => Promise<Response>
) {
  return async (req: Request, route: RouteArgs<P>): Promise<Response> => {
    if (!req.headers.get("authorization")?.startsWith("Bearer ")) {
      return apiError(401, "unauthenticated", "Missing bearer token.");
    }
    try {
      const ctx = await getOrgContext();
      if (!ctx) {
        return apiError(401, "unauthenticated", "Invalid or expired session.");
      }
      return await handler(ctx, req, await route.params);
    } catch (err) {
      console.error(`[api] ${req.method} ${new URL(req.url).pathname}`, err);
      return apiError(500, "internal", "Something went wrong.");
    }
  };
}
