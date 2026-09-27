import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { paymentGateways } from "@/server/db/schema";
import type { OrgContext } from "@/server/auth/context";
import { logActivity } from "@/server/activity";
import { fail, invalid, ok, type ServiceResult } from "@/server/service-result";
import {
  deleteYocoWebhook,
  listYocoWebhooks,
  registerYocoWebhook,
  YocoError,
} from "@/server/gateways/yoco";
import {
  getGateway,
  payfastSecrets,
  sealSecrets,
  yocoSecrets,
  type Provider,
} from "@/server/gateways/store";
import { env } from "@/lib/env";

/** Webhooks need a public HTTPS URL; localhost can't receive them. */
function publicBaseUrl(): string | null {
  return env.APP_URL.startsWith("https://") ? env.APP_URL : null;
}

const payfastSchema = z.object({
  merchantId: z.string().trim().regex(/^\d{8}$/, "Merchant ID is 8 digits"),
  merchantKey: z.string().trim().regex(/^[a-z0-9]{8,32}$/i, "Check the merchant key"),
  /** Blank keeps the current passphrase. */
  passphrase: z.string().trim().max(100).optional(),
  mode: z.enum(["test", "live"]),
});

export async function connectPayfastForOrg(
  ctx: OrgContext,
  raw: unknown
): Promise<ServiceResult<{ mode: string }>> {
  const parsed = payfastSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  const existing = await getGateway(ctx.org.id, "payfast");
  const passphrase = d.passphrase || (existing ? payfastSecrets(existing).passphrase : undefined);

  const values = {
    mode: d.mode,
    enabled: true,
    merchantId: d.merchantId,
    secretsEnc: sealSecrets({ merchantKey: d.merchantKey, passphrase }),
    updatedAt: new Date(),
  };
  await db
    .insert(paymentGateways)
    .values({ orgId: ctx.org.id, provider: "payfast", ...values })
    .onConflictDoUpdate({ target: [paymentGateways.orgId, paymentGateways.provider], set: values });

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: "gateway.connected",
    description: `Connected PayFast (${d.mode === "live" ? "live" : "sandbox"})`,
  });
  return ok({ mode: d.mode });
}

const yocoSchema = z.object({
  secretKey: z.string().trim().regex(/^sk_(test|live)_\S+$/, "Paste your Yoco secret key (starts with sk_test_ or sk_live_)"),
});

/**
 * Connect Yoco: check the key works, then register our webhook on the
 * business's Yoco account so payments are confirmed automatically.
 */
export async function connectYocoForOrg(
  ctx: OrgContext,
  raw: unknown
): Promise<ServiceResult<{ mode: string; webhookRegistered: boolean }>> {
  const parsed = yocoSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const secretKey = parsed.data.secretKey;
  const mode = secretKey.startsWith("sk_live_") ? "live" : "test";

  try {
    await listYocoWebhooks(secretKey);
  } catch (err) {
    if (err instanceof YocoError && (err.status === 401 || err.status === 403)) {
      return fail("validation", "Yoco didn't accept that key.", { secretKey: ["Yoco didn't accept that key"] });
    }
    console.error("[yoco] key check failed", err);
    return fail("upstream", "Couldn't reach Yoco. Please try again.");
  }

  // Replace a previous connection's webhook so the account doesn't fill up (max 5).
  const existing = await getGateway(ctx.org.id, "yoco");
  if (existing?.webhookId) {
    await deleteYocoWebhook(yocoSecrets(existing).secretKey, existing.webhookId).catch(() => {});
  }

  const values = {
    mode,
    enabled: true,
    merchantId: null,
    secretsEnc: sealSecrets({ secretKey }),
    webhookId: null,
    updatedAt: new Date(),
  };
  const [gateway] = await db
    .insert(paymentGateways)
    .values({ orgId: ctx.org.id, provider: "yoco", ...values })
    .onConflictDoUpdate({ target: [paymentGateways.orgId, paymentGateways.provider], set: values })
    .returning();

  let webhookRegistered = false;
  const base = publicBaseUrl();
  if (base) {
    try {
      const hook = await registerYocoWebhook(secretKey, `${base}/api/webhooks/yoco/${gateway.id}`);
      await db
        .update(paymentGateways)
        .set({ webhookId: hook.id, secretsEnc: sealSecrets({ secretKey, webhookSecret: hook.secret }) })
        .where(eq(paymentGateways.id, gateway.id));
      webhookRegistered = true;
    } catch (err) {
      console.error("[yoco] webhook registration failed", err);
    }
  }

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: "gateway.connected",
    description: `Connected Yoco (${mode})`,
  });
  return ok({ mode, webhookRegistered });
}

export async function disconnectGatewayForOrg(
  ctx: OrgContext,
  provider: Provider
): Promise<ServiceResult<{ provider: Provider }>> {
  const existing = await getGateway(ctx.org.id, provider);
  if (!existing) return fail("not_found", "Not connected.");

  if (provider === "yoco" && existing.webhookId) {
    await deleteYocoWebhook(yocoSecrets(existing).secretKey, existing.webhookId).catch((err) =>
      console.error("[yoco] webhook delete failed", err)
    );
  }
  await db
    .delete(paymentGateways)
    .where(and(eq(paymentGateways.orgId, ctx.org.id), eq(paymentGateways.provider, provider)));

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: "gateway.disconnected",
    description: `Disconnected ${provider === "payfast" ? "PayFast" : "Yoco"}`,
  });
  return ok({ provider });
}
