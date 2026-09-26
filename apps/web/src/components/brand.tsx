import Link from "next/link";

import { cn } from "@/lib/utils";

/** App wordmark + glyph. Used in the nav, sidebar, auth and PDF headers. */
export function Logo({
  className,
  href = "/",
  showWordmark = true,
}: {
  className?: string;
  href?: string | null;
  showWordmark?: boolean;
}) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
          <path d="M14 2v6h6" />
          <path d="M9 13h6M9 17h6M9 9h1" />
        </svg>
      </span>
      {showWordmark && (
        <span className="text-lg font-semibold tracking-tight">
          Invoice<span className="text-primary">Gen</span>
        </span>
      )}
    </span>
  );

  if (href === null) return inner;
  return (
    <Link href={href} className="inline-flex">
      {inner}
    </Link>
  );
}
