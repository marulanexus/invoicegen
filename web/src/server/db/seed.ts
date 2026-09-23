/**
 * Development seed. Creates a self-contained demo organization with a business
 * profile, clients, documents (across types/statuses), line items and payments
 * so you can explore the UI and Drizzle Studio immediately.
 *
 * Run with:  npm run db:seed
 *
 * Note: the demo org uses a placeholder Clerk id. When you sign in for real,
 * the app provisions a *separate* personal workspace for your user — this seed
 * is primarily for inspecting the schema and PDF/preview output.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { addDays, subDays } from "date-fns";
import { eq } from "drizzle-orm";

import { db } from "./index";
import {
  businessProfiles,
  clients,
  documents,
  lineItems,
  members,
  organizations,
  payments,
  reminderSettings,
  subscriptions,
} from "./schema";
import { calcDocumentTotals } from "@/lib/calc";
import { toMoneyString } from "@/lib/money";

const DEMO_CLERK_ORG = "demo:invoicegen";

async function main() {
  console.log("🌱 Seeding InvoiceGen demo data…");

  // Reset any prior demo org (cascades to all child rows).
  const existing = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, DEMO_CLERK_ORG))
    .limit(1);
  if (existing[0]) {
    await db.delete(organizations).where(eq(organizations.id, existing[0].id));
  }

  const [org] = await db
    .insert(organizations)
    .values({ clerkOrgId: DEMO_CLERK_ORG, name: "Northwind Studio", plan: "growth" })
    .returning();

  await db.insert(subscriptions).values({
    orgId: org.id,
    plan: "growth",
    status: "active",
    seats: 1,
  });

  await db.insert(businessProfiles).values({
    orgId: org.id,
    legalName: "Northwind Studio LLC",
    displayName: "Northwind Studio",
    email: "billing@northwind.studio",
    phone: "+1 (415) 555-0142",
    website: "https://northwind.studio",
    addressLine1: "2100 Market Street",
    addressLine2: "Suite 300",
    city: "San Francisco",
    state: "CA",
    postalCode: "94114",
    country: "United States",
    brandColor: "#2563eb",
    taxLabel: "Sales Tax",
    defaultTaxRate: "8.50",
    defaultCurrency: "USD",
    paymentTermsDays: 14,
    invoiceCounter: 4,
    quoteCounter: 2,
    receiptCounter: 2,
    defaultNotes: "Thank you for your business!",
    defaultTerms: "Payment due within 14 days. Late payments incur 1.5% monthly interest.",
    onboardingCompleted: true,
  });

  const [owner] = await db
    .insert(members)
    .values({
      orgId: org.id,
      clerkUserId: "demo:owner",
      email: "alex@northwind.studio",
      name: "Alex Rivera",
      role: "owner",
    })
    .returning();

  await db.insert(reminderSettings).values({
    orgId: org.id,
    enabled: true,
    schedule: [-3, 1, 7],
  });

  const clientSeeds = [
    {
      name: "Acme Corporation",
      companyName: "Acme Corporation",
      contactName: "Jane Doe",
      email: "ap@acme.com",
      phone: "+1 (212) 555-0188",
      city: "New York",
      country: "United States",
      tags: ["enterprise", "retainer"],
    },
    {
      name: "Bluebird Cafe",
      companyName: "Bluebird Cafe",
      contactName: "Marco Diaz",
      email: "marco@bluebirdcafe.com",
      city: "Austin",
      country: "United States",
      tags: ["hospitality"],
    },
    {
      name: "Helena Brooks",
      contactName: "Helena Brooks",
      email: "helena.brooks@gmail.com",
      city: "Denver",
      country: "United States",
      tags: ["individual"],
    },
    {
      name: "Quantum Labs",
      companyName: "Quantum Labs Inc.",
      contactName: "Priya Patel",
      email: "finance@quantumlabs.io",
      city: "Seattle",
      country: "United States",
      tags: ["tech", "monthly"],
    },
  ];

  const insertedClients = await db
    .insert(clients)
    .values(clientSeeds.map((c) => ({ ...c, orgId: org.id })))
    .returning();

  // Helper to create a document + its line items with correct totals.
  async function createDoc(opts: {
    type: "invoice" | "quote" | "receipt";
    number: string;
    clientIndex: number;
    status: (typeof documents.$inferInsert)["status"];
    issueOffset: number; // days from today (negative = past)
    dueOffset?: number;
    amountPaid?: number;
    items: { description: string; quantity: number; unitPrice: number; taxRate?: number }[];
  }) {
    const totals = calcDocumentTotals(
      opts.items.map((i) => ({
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxRate: i.taxRate ?? 8.5,
      }))
    );

    const [doc] = await db
      .insert(documents)
      .values({
        orgId: org.id,
        clientId: insertedClients[opts.clientIndex].id,
        type: opts.type,
        number: opts.number,
        status: opts.status,
        currency: "USD",
        issueDate: dateStr(opts.issueOffset),
        dueDate: opts.dueOffset !== undefined ? dateStr(opts.dueOffset) : null,
        validUntil:
          opts.type === "quote" ? dateStr((opts.dueOffset ?? 30)) : null,
        subtotal: toMoneyString(totals.subtotal),
        discountTotal: toMoneyString(totals.discountTotal),
        taxTotal: toMoneyString(totals.taxTotal),
        total: toMoneyString(totals.total),
        amountPaid: toMoneyString(opts.amountPaid ?? 0),
        taxLabel: "Sales Tax",
        templateKey: "classic",
        notes: "Thank you for your business!",
        createdByMemberId: owner.id,
        sentAt: opts.status === "draft" ? null : new Date(),
        paidAt: opts.status === "paid" ? new Date() : null,
      })
      .returning();

    await db.insert(lineItems).values(
      opts.items.map((i, idx) => {
        const net = i.quantity * i.unitPrice;
        return {
          documentId: doc.id,
          position: idx,
          description: i.description,
          quantity: String(i.quantity),
          unitPrice: toMoneyString(i.unitPrice),
          taxRate: String(i.taxRate ?? 8.5),
          amount: toMoneyString(net),
        };
      })
    );

    if ((opts.amountPaid ?? 0) > 0) {
      await db.insert(payments).values({
        orgId: org.id,
        documentId: doc.id,
        clientId: insertedClients[opts.clientIndex].id,
        amount: toMoneyString(opts.amountPaid!),
        currency: "USD",
        method: "bank_transfer",
        reference: "Seed payment",
        recordedByMemberId: owner.id,
      });
    }

    return doc;
  }

  await createDoc({
    type: "invoice",
    number: "INV-0001",
    clientIndex: 0,
    status: "paid",
    issueOffset: -40,
    dueOffset: -26,
    amountPaid: 5422.5,
    items: [
      { description: "Brand identity design", quantity: 1, unitPrice: 3500 },
      { description: "Logo variations (set of 5)", quantity: 1, unitPrice: 1500 },
    ],
  });

  await createDoc({
    type: "invoice",
    number: "INV-0002",
    clientIndex: 3,
    status: "overdue",
    issueOffset: -30,
    dueOffset: -16,
    items: [
      { description: "Monthly retainer — engineering", quantity: 40, unitPrice: 120 },
    ],
  });

  await createDoc({
    type: "invoice",
    number: "INV-0003",
    clientIndex: 1,
    status: "partial",
    issueOffset: -8,
    dueOffset: 6,
    amountPaid: 500,
    items: [
      { description: "Website redesign — phase 1", quantity: 1, unitPrice: 2400 },
      { description: "Copywriting", quantity: 6, unitPrice: 90 },
    ],
  });

  await createDoc({
    type: "quote",
    number: "QUO-0001",
    clientIndex: 2,
    status: "sent",
    issueOffset: -3,
    dueOffset: 27,
    items: [
      { description: "Portrait session (half day)", quantity: 1, unitPrice: 850 },
      { description: "Edited high-res photos", quantity: 30, unitPrice: 15 },
    ],
  });

  await createDoc({
    type: "receipt",
    number: "REC-0001",
    clientIndex: 0,
    status: "paid",
    issueOffset: -26,
    amountPaid: 5422.5,
    items: [{ description: "Payment received — INV-0001", quantity: 1, unitPrice: 5000 }],
  });

  console.log(`✅ Seeded org "${org.name}" with ${insertedClients.length} clients and demo documents.`);
  console.log("   Open Drizzle Studio with: npm run db:studio");
  process.exit(0);
}

function dateStr(offsetDays: number): string {
  const base = offsetDays >= 0 ? addDays(new Date(), offsetDays) : subDays(new Date(), -offsetDays);
  return base.toISOString().slice(0, 10);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
