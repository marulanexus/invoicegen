import type { BusinessProfile, Client } from "@/server/db/schema";

/** Business details as they appear on a document (frozen when it's issued). */
export function snapshotFrom(p: BusinessProfile | null) {
  if (!p) return undefined;
  return {
    name: p.displayName,
    legalName: p.legalName,
    email: p.email,
    phone: p.phone,
    website: p.website,
    address: [p.addressLine1, p.addressLine2, [p.city, p.state].filter(Boolean).join(", "), p.postalCode, p.country].filter(Boolean),
    taxId: p.taxId,
    logoUrl: p.logoUrl,
    vatRegistered: p.vatRegistered,
    country: p.country,
  };
}

/** Client details as they appear on a document (frozen when it's issued). */
export function snapshotBillTo(c: Client | undefined) {
  if (!c) return undefined;
  return {
    name: c.name,
    company: c.companyName,
    contact: c.contactName,
    email: c.email,
    phone: c.phone,
    address: [c.addressLine1, c.addressLine2, [c.city, c.state].filter(Boolean).join(", "), c.postalCode, c.country].filter(Boolean),
    taxId: c.taxId,
    country: c.country,
  };
}
