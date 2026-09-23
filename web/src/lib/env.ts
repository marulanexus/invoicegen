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

  // Cron / scheduled jobs
  CRON_SECRET: get("CRON_SECRET"),

  // Blob storage (Vercel Blob) for logos & stored PDFs
  BLOB_READ_WRITE_TOKEN: get("BLOB_READ_WRITE_TOKEN"),
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
export const isBlobConfigured = Boolean(env.BLOB_READ_WRITE_TOKEN);

export function requireDb(): string {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string."
    );
  }
  return env.DATABASE_URL;
}
