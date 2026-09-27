import Link from "next/link";
import { Check } from "lucide-react";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { PLAN_ORDER, PLANS } from "@/lib/plans";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link href="/#features" className="hover:text-foreground">
            Features
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/faq" className="hover:text-foreground">
            FAQ
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 sm:px-6 md:flex-row">
        <div className="flex flex-col items-center gap-2 md:items-start">
          <Logo />
          <p className="text-sm text-muted-foreground">
            Invoices, quotes & receipts for small business.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/faq" className="hover:text-foreground">
            FAQ
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/sign-in" className="hover:text-foreground">
            Sign in
          </Link>
          <span>© {new Date().getFullYear()} InvoiceGen</span>
        </div>
      </div>
    </footer>
  );
}

export function PricingCards({ ctaHref = "/sign-up" }: { ctaHref?: string }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {PLAN_ORDER.map((id) => {
        const plan = PLANS[id];
        const featured = id === "growth";
        return (
          <div
            key={id}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm",
              featured && "border-primary shadow-md ring-1 ring-primary/20"
            )}
          >
            {featured && (
              <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                Most popular
              </span>
            )}
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">
                R{plan.zar.monthly}
              </span>
              <span className="text-sm text-muted-foreground">/month</span>
            </div>
            {plan.zar.yearly > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                or R{plan.zar.yearly.toLocaleString("en-ZA")}/year (2 months free)
              </p>
            )}
            <ul className="mt-6 flex-1 space-y-3 text-sm">
              {plan.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              className="mt-6"
              variant={featured ? "default" : "outline"}
            >
              <Link href={ctaHref}>
                {plan.zar.monthly === 0 ? "Start free" : `Choose ${plan.name}`}
              </Link>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
