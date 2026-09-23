import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/marketing";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about InvoiceGen.",
};

const FAQ_GROUPS: { category: string; items: { q: string; a: string }[] }[] = [
  {
    category: "Getting started",
    items: [
      {
        q: "What is InvoiceGen?",
        a: "InvoiceGen is a modern tool for freelancers, sole traders, consultants and small businesses to create, send and track professional invoices, quotes and receipts — from any device.",
      },
      {
        q: "Do I need to install anything?",
        a: "No. InvoiceGen runs entirely in your browser and is fully mobile-friendly, so you can create and send invoices on your phone while on the go.",
      },
      {
        q: "How long does it take to send my first invoice?",
        a: "Usually under a minute. After a quick business setup, you save a client once, add line items, watch the live preview, and send a polished PDF by email.",
      },
    ],
  },
  {
    category: "Plans & billing",
    items: [
      {
        q: "Is there a free plan?",
        a: "Yes. The Free Starter plan lets you manage up to 3 clients and send up to 5 documents per month — no credit card required.",
      },
      {
        q: "What counts as a document?",
        a: "Any invoice, quote or receipt you create. The free monthly limit resets at the start of each calendar month.",
      },
      {
        q: "What do paid plans add?",
        a: "Growth Pro unlocks unlimited clients and documents, automated reminders and recurring invoices. Business Plus adds team seats, custom branding (removing “Powered by”), and advanced reporting.",
      },
      {
        q: "Can I change or cancel my plan?",
        a: "Anytime, from Settings → Billing. Upgrades and downgrades are prorated, and if you cancel you keep access until the end of your current billing period.",
      },
    ],
  },
  {
    category: "Documents & sending",
    items: [
      {
        q: "Can I customize how my invoices look?",
        a: "Yes. Choose from professional templates, set your brand color and logo, and pick a default template for new documents. The on-screen preview always matches the PDF your client receives.",
      },
      {
        q: "Can clients view documents online?",
        a: "When you email a document, InvoiceGen includes a secure share link to an online view, and marks the document as “viewed” the first time it's opened.",
      },
      {
        q: "Can I send from my own email address?",
        a: "Yes. You can connect your own SMTP server in Settings → Email, or use the platform's default sender.",
      },
      {
        q: "Do you support multiple currencies and taxes?",
        a: "Yes. Set a default currency and tax (VAT, GST or sales tax) for your business, and override them globally or per client.",
      },
      {
        q: "Can I set up recurring invoices?",
        a: "On Growth Pro and above, you can turn any invoice into a recurring schedule (weekly, monthly, quarterly or yearly) that generates draft invoices automatically.",
      },
    ],
  },
  {
    category: "Data & security",
    items: [
      {
        q: "Is my data secure?",
        a: "Your data is isolated per account, encrypted in transit, and sensitive credentials are encrypted at rest. We also keep an activity log of key actions. See our Privacy Policy for details.",
      },
      {
        q: "Who owns my data?",
        a: "You do. You can export your documents as PDFs at any time, and we only process your content to operate the Service.",
      },
      {
        q: "How do I get help?",
        a: "Reach us anytime at support@invoicegen.app — we're happy to help.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Frequently asked questions
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Everything you need to know about InvoiceGen. Can&apos;t find an
              answer? Email{" "}
              <a
                href="mailto:support@invoicegen.app"
                className="font-medium text-primary hover:underline"
              >
                support@invoicegen.app
              </a>
              .
            </p>
          </div>

          <div className="mt-12 space-y-10">
            {FAQ_GROUPS.map((group) => (
              <section key={group.category}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.category}
                </h2>
                <div className="mt-4 divide-y rounded-xl border bg-card">
                  {group.items.map((item) => (
                    <details key={item.q} className="group p-5 [&_summary]:list-none">
                      <summary className="flex cursor-pointer items-center justify-between gap-3 font-medium">
                        {item.q}
                        <span className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45">
                          +
                        </span>
                      </summary>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-14 rounded-2xl bg-primary px-6 py-10 text-center text-primary-foreground">
            <h2 className="text-2xl font-bold tracking-tight">
              Still have questions?
            </h2>
            <p className="mx-auto mt-2 max-w-md text-primary-foreground/80">
              Start free in minutes — no credit card required.
            </p>
            <Button size="lg" variant="secondary" asChild className="mt-6">
              <Link href="/sign-up">Create your free account</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
