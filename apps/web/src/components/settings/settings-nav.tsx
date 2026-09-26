"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { label: "Business", href: "/settings" },
  { label: "Email", href: "/settings/email" },
  { label: "Templates", href: "/settings/templates" },
  { label: "Billing", href: "/settings/billing" },
  { label: "Team", href: "/settings/team" },
  { label: "Activity", href: "/settings/activity" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b">
      {ITEMS.map((item) => {
        const active =
          item.href === "/settings"
            ? pathname === "/settings"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
