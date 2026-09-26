import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Clock,
  FileText,
  Globe,
  Repeat,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PricingCards, SiteFooter, SiteHeader } from "@/components/marketing";

const FEATURES = [
  {
    icon: FileText,
    title: "Beautiful documents",
    body: "Invoices, quotes and receipts from professional templates with your logo and brand color.",
  },
  {
    icon: Clock,
    title: "Sent in under a minute",
    body: "Smart defaults, saved clients and live preview mean you create and send while on the go.",
  },
  {
    icon: Smartphone,
    title: "Mobile-first",
    body: "Built to be excellent on your phone — invoice a client from the job site, not the office.",
  },
  {
    icon: Bell,
    title: "Automated reminders",
    body: "Stop chasing payments. Polite, configurable reminders go out before and after the due date.",
  },
  {
    icon: Repeat,
    title: "Recurring invoices",
    body: "Set retainers and subscriptions on autopilot — they generate and send themselves.",
  },
  {
    icon: Globe,
    title: "Multi-currency & tax",
    body: "Bill anyone, anywhere with per-client currencies, VAT/GST/sales tax and discounts.",
  },
  {
    icon: BarChart3,
    title: "Clear dashboards",
    body: "Revenue, outstanding and overdue at a glance, with monthly and quarterly trends.",
  },
  {
    icon: ShieldCheck,
    title: "Secure & compliant",
    body: "Sequential numbering, audit logs and GDPR-friendly data handling out of the box.",
  },
];

const STEPS = [
  { n: "1", title: "Set up your business", body: "Add your logo, address, tax and currency once." },
  { n: "2", title: "Add a client", body: "Save their details so future invoices take seconds." },
  { n: "3", title: "Build & preview", body: "Add line items and watch the document update live." },
  { n: "4", title: "Send & get paid", body: "Email a polished PDF and track when it's viewed and paid." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent" />
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                The fastest way to invoice
              </span>
              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
                Get paid faster with{" "}
                <span className="text-primary">effortless invoices</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                InvoiceGen helps freelancers, consultants and small businesses
                create, send and track beautiful invoices, quotes and receipts —
                in seconds, from any device.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link href="/sign-up">
                    Start free <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/pricing">View pricing</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                No credit card required · Free for up to 5 documents / month
              </p>
            </div>

            {/* Hero mock */}
            <div className="mx-auto mt-16 max-w-4xl">
              <div className="rounded-2xl border bg-card p-2 shadow-xl">
                <div className="rounded-xl border bg-background p-6 sm:p-10">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="h-3 w-28 rounded bg-primary/80" />
                      <div className="mt-2 h-2 w-20 rounded bg-muted" />
                    </div>
                    <div className="text-right">
                      <div className="ml-auto h-3 w-24 rounded bg-muted" />
                      <div className="ml-auto mt-2 h-2 w-16 rounded bg-muted" />
                    </div>
                  </div>
                  <div className="mt-8 space-y-3">
                    {[70, 55, 80, 40].map((w, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="h-2.5 rounded bg-muted" style={{ width: `${w}%` }} />
                        <div className="h-2.5 w-12 rounded bg-muted" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 flex justify-end">
                    <div className="w-48 space-y-2">
                      <div className="flex justify-between">
                        <div className="h-2 w-16 rounded bg-muted" />
                        <div className="h-2 w-12 rounded bg-muted" />
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <div className="h-3 w-14 rounded bg-foreground/80" />
                        <div className="h-3 w-16 rounded bg-primary" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to bill with confidence
            </h2>
            <p className="mt-4 text-muted-foreground">
              Powerful where it counts, calm everywhere else. Built to feel fast.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                From zero to paid in four steps
              </h2>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <div key={s.n} className="relative rounded-xl border bg-card p-6">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {s.n}
                  </span>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, honest pricing
            </h2>
            <p className="mt-4 text-muted-foreground">
              Start free. Upgrade when you grow. Cancel anytime.
            </p>
          </div>
          <div className="mt-12">
            <PricingCards />
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="overflow-hidden rounded-2xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to send your first invoice?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
              Join freelancers and small businesses getting paid faster.
            </p>
            <Button size="lg" variant="secondary" asChild className="mt-8">
              <Link href="/sign-up">
                Create your free account <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
