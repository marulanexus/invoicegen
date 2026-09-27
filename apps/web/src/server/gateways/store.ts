import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { paymentGateways, type PaymentGateway } from "@/server/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

/** Secrets kept encrypted in `payment_gateways.secrets_enc`, per provider. */
export interface PayfastSecrets {
  merchantKey: string;
  passphrase?: string;
}
export interface YocoSecrets {
  secretKey: string;
  webhookSecret?: string;
}

export type Provider = PaymentGateway["provider"];

export function sealSecrets(secrets: PayfastSecrets | YocoSecrets): string {
  return encryptSecret(JSON.stringify(secrets));
}

export function payfastSecrets(g: PaymentGateway): PayfastSecrets {
  return JSON.parse(decryptSecret(g.secretsEnc)) as PayfastSecrets;
}

export function yocoSecrets(g: PaymentGateway): YocoSecrets {
  return JSON.parse(decryptSecret(g.secretsEnc)) as YocoSecrets;
}

export async function getGateway(orgId: string, provider: Provider): Promise<PaymentGateway | null> {
  const [row] = await db
    .select()
    .from(paymentGateways)
    .where(and(eq(paymentGateways.orgId, orgId), eq(paymentGateways.provider, provider)))
    .limit(1);
  return row ?? null;
}

export async function getGatewayById(id: string): Promise<PaymentGateway | null> {
  const [row] = await db.select().from(paymentGateways).where(eq(paymentGateways.id, id)).limit(1);
  return row ?? null;
}

/** Providers a payer can use for this org right now. */
export async function enabledProviders(orgId: string): Promise<Provider[]> {
  const rows = await db
    .select({ provider: paymentGateways.provider })
    .from(paymentGateways)
    .where(and(eq(paymentGateways.orgId, orgId), eq(paymentGateways.enabled, true)));
  return rows.map((r) => r.provider);
}

/** Settings view: what's connected, without any secrets. */
export interface GatewaySummary {
  provider: Provider;
  mode: string;
  enabled: boolean;
  merchantId: string | null;
  webhookRegistered: boolean;
  connectedAt: Date;
}

export async function listGatewaySummaries(orgId: string): Promise<GatewaySummary[]> {
  const rows = await db.select().from(paymentGateways).where(eq(paymentGateways.orgId, orgId));
  return rows.map((g) => ({
    provider: g.provider,
    mode: g.mode,
    enabled: g.enabled,
    merchantId: g.merchantId,
    webhookRegistered: Boolean(g.webhookId),
    connectedAt: g.createdAt,
  }));
}
