import { z } from "zod";

import { apiError, apiResult, readJson } from "@/server/api/http";
import { startCheckout } from "@/server/gateways/checkout";

export const runtime = "nodejs";

const body = z.object({ provider: z.enum(["payfast", "yoco"]) });

/**
 * Public "Pay now" for a shared invoice. Returns where to send the payer:
 * `{ kind: "redirect", url }` (Yoco) or `{ kind: "form", action, fields }`
 * (PayFast, posted by the browser).
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, "bad_request", "Choose a payment method.");
  return apiResult(await startCheckout(token, parsed.data.provider));
}
