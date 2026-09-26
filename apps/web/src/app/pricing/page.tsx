import type { Metadata } from "next";

import { PricingCards, SiteFooter, SiteHeader } from "@/components/marketing";

export const metadata: Metadata = { title: "Pricing" };

const FAQ = [
  {
    q: "Can I try it for free?",
    a: "Yes. The Free Starter plan lets you manage up to 3 clients and send 5 documents per month — no credit card required.",
  },
  {
    q: "What counts as a document?",
    a: "Any invoice, quote or receipt you create. The free limit resets at the start of each calendar month.",
  },
  {
    q: "Can I change plans later?",
    a: "Absolutely. Upgrade or downgrade anytime from Settings → Billing. Changes are prorated automatically.",
  },
  {
    q: "Do you support my currency and tax rules?",
    a: "InvoiceGen supports multiple currencies and configurable tax (VAT, GST, sales tax) globally or per client.",
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Pricing that grows with you
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Start free. Upgrade for automation, team seats and custom branding.
            </p>
          </div>
          <div className="mt-12">
            <PricingCards />
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Frequently asked questions
          </h2>
          <div className="mt-8 divide-y rounded-xl border bg-card">
            {FAQ.map((item) => (
              <div key={item.q} className="p-6">
                <h3 className="font-semibold">{item.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
