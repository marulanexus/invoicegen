import Link from "next/link";

import { Logo } from "@/components/brand";

/** Centered split layout used by the sign-in and sign-up pages. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <Logo href="/" className="text-primary-foreground [&_span.text-primary]:text-primary-foreground" />
        <div>
          <blockquote className="text-2xl font-semibold leading-relaxed">
            “I sent my first invoice on my phone during a coffee break. Paid two
            days later.”
          </blockquote>
          <p className="mt-4 text-sm text-primary-foreground/80">
            — A very happy freelancer
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">
          © {new Date().getFullYear()} InvoiceGen
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="lg:hidden">
          <Logo href="/" />
        </div>
        <div className="mt-8 w-full max-w-sm lg:mt-0">{children}</div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms
          </Link>{" "}
          &{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/** Shown when Clerk keys are not yet configured during local setup. */
export function AuthNotConfigured() {
  return (
    <div className="rounded-xl border bg-card p-6 text-center">
      <h1 className="text-lg font-semibold">Authentication not configured</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Add your Clerk keys to <code className="font-mono">.env.local</code> to
        enable sign in. See the README for setup.
      </p>
      <Link
        href="/"
        className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        ← Back home
      </Link>
    </div>
  );
}
