"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Menu, Plus, Sparkles, X } from "lucide-react";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/app/command-palette";
import { NAV_ITEMS } from "@/components/app/nav-items";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  planName: string;
  isFreePlan: boolean;
  orgName: string;
}

export function AppShell({ children, planName, isFreePlan, orgName }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const navList = (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="h-4.5 w-4.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const planCard = isFreePlan ? (
    <div className="m-3 rounded-xl border bg-sidebar-accent/50 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" />
        {planName}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Upgrade for unlimited invoices, reminders & recurring billing.
      </p>
      <Button size="sm" className="mt-3 w-full" asChild>
        <Link href="/settings/billing">Upgrade</Link>
      </Button>
    </div>
  ) : (
    <div className="m-3 rounded-xl border bg-sidebar-accent/50 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <Sparkles className="h-4 w-4 text-primary" />
        {planName}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Logo href="/dashboard" />
        </div>
        {navList}
        {planCard}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r bg-sidebar shadow-xl">
            <div className="flex h-16 items-center justify-between border-b px-5">
              <Logo href="/dashboard" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {navList}
            {planCard}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <span className="hidden truncate text-sm font-medium text-muted-foreground sm:inline">
            {orgName}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <CommandPalette />
            <Button size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/documents/new?type=invoice">
                <Plus className="h-4 w-4" /> New invoice
              </Link>
            </Button>
            <Button size="icon" asChild className="sm:hidden" aria-label="New invoice">
              <Link href="/documents/new?type=invoice">
                <Plus className="h-5 w-5" />
              </Link>
            </Button>
            <ThemeToggle />
            <UserButton />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
