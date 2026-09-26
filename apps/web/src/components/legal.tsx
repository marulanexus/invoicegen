import { SiteFooter, SiteHeader } from "@/components/marketing";

/**
 * Shared shell for legal / informational pages (privacy, terms). Applies a
 * readable "prose" style to plain h2/h3/p/ul/a children via descendant
 * selectors so page content stays simple JSX.
 */
export function LegalPage({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string;
  lastUpdated: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
          {intro && (
            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              {intro}
            </p>
          )}
          <div
            className="mt-8 text-sm leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a:hover]:underline [&_h2]:mb-2 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mb-1 [&_h3]:mt-5 [&_h3]:font-medium [&_h3]:text-foreground [&_li]:mt-1 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_p]:mt-3 [&_strong]:text-foreground [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6"
          >
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
