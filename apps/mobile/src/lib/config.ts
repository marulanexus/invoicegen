/**
 * Build-time config from `.env.local` (EXPO_PUBLIC_* values are inlined into
 * the app bundle, so never put secrets here).
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set. Copy apps/mobile/.env.example to .env.local and fill it in.`);
  }
  return value;
}

/** The web app's base URL, e.g. http://192.168.1.20:3000 in development. */
export const API_URL = required("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL).replace(/\/+$/, "");

export const CLERK_PUBLISHABLE_KEY = required(
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
);
