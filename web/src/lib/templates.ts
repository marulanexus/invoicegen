/**
 * Built-in document templates. The `key` is stored on each document and used
 * by the PDF renderer and on-screen preview to pick a layout. `tier: "free"`
 * templates are available to everyone; "pro" ones require a paid plan.
 */

export interface DocTemplate {
  key: string;
  name: string;
  description: string;
  accent: string;
  tier: "free" | "pro";
  /** Layout variant the renderer switches on. */
  layout: "classic" | "modern" | "minimal" | "bold";
}

export const DOCUMENT_TEMPLATES: DocTemplate[] = [
  {
    key: "classic",
    name: "Classic",
    description: "Timeless, professional layout with a clean header.",
    accent: "#2563eb",
    tier: "free",
    layout: "classic",
  },
  {
    key: "modern",
    name: "Modern",
    description: "Accent sidebar with bold totals — great for agencies.",
    accent: "#0ea5e9",
    tier: "free",
    layout: "modern",
  },
  {
    key: "minimal",
    name: "Minimal",
    description: "Understated black-and-white typography focus.",
    accent: "#111827",
    tier: "pro",
    layout: "minimal",
  },
  {
    key: "bold",
    name: "Corporate Bold",
    description: "Strong color blocks and confident headings.",
    accent: "#7c3aed",
    tier: "pro",
    layout: "bold",
  },
];

export function getTemplate(key: string | null | undefined): DocTemplate {
  return (
    DOCUMENT_TEMPLATES.find((t) => t.key === key) ?? DOCUMENT_TEMPLATES[0]
  );
}
