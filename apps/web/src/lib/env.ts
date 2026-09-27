/**
 * Centralized, typed access to environment variables.
 *
 * Integration secrets (Clerk, Stripe, Resend, Google) are treated as OPTIONAL
 * so the app can build and boot in a partially-configured state during local
 * development. Each integration exposes an `isXConfigured` flag; feature code
 * should check the flag and degrade gracefully (e.g. show a "connect Stripe"
 * notice) rather than crashing when a key is absent.
 *
 * `DATABASE_URL` is the one hard requirement for any data operation. We do not
 * throw at import time (that would break `next build`); instead `requireDb()`
 * throws lazily with a helpful message the first time the DB is actually used.
 */

function get(key: string): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

export const env = {
  // Core
  NODE_ENV: process.env.NODE_ENV ?? "development",
  APP_URL: get("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  DATABASE_URL: get("DATABASE_URL"),

  // Clerk
  CLERK_PUBLISHABLE_KEY: get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
  CLERK_SECRET_KEY: get("CLERK_SECRET_KEY"),
  CLERK_WEBHOOK_SECRET: get("CLERK_WEBHOOK_SECRET"),

  // Stripe
  STRIPE_SECRET_KEY: get("STRIPE_SECRET_KEY"),
  STRIPE_PUBLISHABLE_KEY: get("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
  STRIPE_WEBHOOK_SECRET: get("STRIPE_WEBHOOK_SECRET"),
  STRIPE_PRICE_GROWTH: get("STRIPE_PRICE_GROWTH"),
  STRIPE_PRICE_BUSINESS: get("STRIPE_PRICE_BUSINESS"),

  // Email (Resend platform default)
  RESEND_API_KEY: get("RESEND_API_KEY"),
  EMAIL_FROM: get("EMAIL_FROM") ?? "InvoiceGen <invoices@example.com>",

  // Google Calendar (optional integration)
  GOOGLE_CLIENT_ID: get("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: get("GOOGLE_CLIENT_SECRET"),

  // Expo push service. Optional: only needed when "enhanced push security"
  // is enabled for the project in the EAS dashboard.
  EXPO_ACCESS_TOKEN: get("EXPO_ACCESS_TOKEN"),

  // Cron / scheduled jobs
  CRON_SECRET: get("CRON_SECRET"),

  // Object storage (Cloudflare R2, S3 API). Public bucket: logos. Private: PDFs.
  R2_ACCOUNT_ID: get("R2_ACCOUNT_ID"),
  R2_ACCESS_KEY_ID: get("R2_ACCESS_KEY_ID"),
  R2_SECRET_ACCESS_KEY: get("R2_SECRET_ACCESS_KEY"),
  R2_PUBLIC_BUCKET: get("R2_PUBLIC_BUCKET"),
  /** Base URL serving the public bucket (custom domain or r2.dev), no trailing slash. */
  R2_PUBLIC_URL: get("R2_PUBLIC_URL")?.replace(/\/+$/, ""),
  R2_PRIVATE_BUCKET: get("R2_PRIVATE_BUCKET"),
} as const;

export const isDbConfigured = Boolean(env.DATABASE_URL);
export const isClerkConfigured = Boolean(
  env.CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY
);
export const isStripeConfigured = Boolean(env.STRIPE_SECRET_KEY);
export const isResendConfigured = Boolean(env.RESEND_API_KEY);
export const isGoogleConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
);
const isR2Connected = Boolean(
  env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY
);
/** Logo uploads work (public bucket + its public URL are set). */
export const isPublicStorageConfigured = Boolean(
  isR2Connected && env.R2_PUBLIC_BUCKET && env.R2_PUBLIC_URL
);
/** Private document storage works (PDF archive, later proof of payment). */
export const isPrivateStorageConfigured = Boolean(
  isR2Connected && env.R2_PRIVATE_BUCKET
);

export function requireDb(): string {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string."
    );
  }
  return env.DATABASE_URL;
}
