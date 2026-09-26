import type { ZodError } from "zod";

/**
 * Outcome of a domain service call (`src/server/<domain>/service.ts`).
 *
 * Services hold the business rules shared by server actions (web) and the
 * `/api/v1` route handlers (mobile). They never throw for expected failures;
 * each caller maps the result to its own shape (ActionResult or HTTP status).
 */
export type ServiceErrorCode = "validation" | "not_found" | "plan_limit";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ServiceErrorCode;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

export function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function fail(
  code: ServiceErrorCode,
  error: string,
  fieldErrors?: Record<string, string[]>
): ServiceResult<never> {
  return { ok: false, code, error, fieldErrors };
}

export function invalid(err: ZodError): ServiceResult<never> {
  return fail(
    "validation",
    "Please check the highlighted fields.",
    err.flatten().fieldErrors as Record<string, string[]>
  );
}
