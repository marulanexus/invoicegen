import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/context", () => ({ getOrgContext: vi.fn() }));

import { getOrgContext, type OrgContext } from "@/server/auth/context";
import { apiResult, isUuid, withApiAuth } from "./http";
import { fail, ok } from "@/server/service-result";

const ctx = { org: { id: "org-1" } } as unknown as OrgContext;
const route = { params: Promise.resolve({ id: "abc" }) };

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/v1/clients", { headers });
}

async function body(res: Response) {
  return (await res.json()) as { data?: unknown; error?: { code: string; message: string } };
}

describe("withApiAuth", () => {
  beforeEach(() => vi.mocked(getOrgContext).mockReset());

  it("rejects requests without a bearer token, before touching auth", async () => {
    const handler = vi.fn();
    const res = await withApiAuth(handler)(request({ cookie: "__session=x" }), route);
    expect(res.status).toBe(401);
    expect((await body(res)).error?.code).toBe("unauthenticated");
    expect(getOrgContext).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects an invalid or expired session", async () => {
    vi.mocked(getOrgContext).mockResolvedValue(null);
    const res = await withApiAuth(vi.fn())(request({ authorization: "Bearer bad" }), route);
    expect(res.status).toBe(401);
  });

  it("passes the tenant and awaited params to the handler", async () => {
    vi.mocked(getOrgContext).mockResolvedValue(ctx);
    const handler = vi.fn(async () => Response.json({ data: "ok" }));
    const res = await withApiAuth<{ id: string }>(handler)(
      request({ authorization: "Bearer good" }),
      route
    );
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(ctx, expect.any(Request), { id: "abc" });
  });

  it("turns unexpected errors into a 500 without leaking details", async () => {
    vi.mocked(getOrgContext).mockResolvedValue(ctx);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await withApiAuth<{ id: string }>(async () => {
      throw new Error("connection string postgres://secret");
    })(request({ authorization: "Bearer good" }), route);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await body(res))).not.toContain("secret");
  });
});

describe("apiResult", () => {
  it("wraps success data", async () => {
    const res = apiResult(ok({ id: "1" }), 201);
    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ data: { id: "1" } });
  });

  it.each([
    ["validation", 422],
    ["not_found", 404],
    ["plan_limit", 403],
  ] as const)("maps %s to HTTP %i", async (code, status) => {
    const res = apiResult(fail(code, "nope", code === "validation" ? { name: ["Required"] } : undefined));
    expect(res.status).toBe(status);
    const b = await body(res);
    expect(b.error?.code).toBe(code);
  });
});

describe("isUuid", () => {
  it("accepts UUIDs and rejects anything else", () => {
    expect(isUuid("6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f")).toBe(true);
    expect(isUuid("1 or 1=1")).toBe(false);
  });
});
