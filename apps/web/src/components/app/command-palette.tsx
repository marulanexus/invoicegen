"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search, Users } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/money";
import { statusMeta } from "@/lib/format";
import { globalSearch, type SearchResults } from "@/server/search/actions";

interface FlatItem {
  href: string;
  label: string;
  sub?: string;
  kind: "client" | "document";
  badge?: { label: string; variant: ReturnType<typeof statusMeta>["variant"] };
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ clients: [], documents: [] });
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl+K shortcut.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        setResults(await globalSearch(query));
        setActive(0);
      });
    }, 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setQuery("");
  }, [open]);

  const items: FlatItem[] = useMemo(() => {
    const docs: FlatItem[] = results.documents.map((d) => {
      const meta = statusMeta(d.status);
      return {
        href: `/documents/${d.id}`,
        label: `${d.number}`,
        sub: `${d.clientName ?? "No client"} · ${formatCurrency(d.total, d.currency)}`,
        kind: "document",
        badge: { label: meta.label, variant: meta.variant },
      };
    });
    const people: FlatItem[] = results.clients.map((c) => ({
      href: `/clients/${c.id}`,
      label: c.name,
      sub: c.email ?? undefined,
      kind: "client",
    }));
    return [...docs, ...people];
  }, [results]);

  function go(item: FlatItem) {
    setOpen(false);
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      go(items[active]);
    }
  }

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
        <span className="hidden lg:inline">Search…</span>
        <kbd className="ml-2 hidden rounded border bg-muted px-1.5 text-[10px] font-medium lg:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[15%] translate-y-0 gap-0 p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search invoices, quotes, clients…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {pending
                  ? "Searching…"
                  : query
                    ? "No results."
                    : "Type to search across your workspace."}
              </p>
            ) : (
              <ul>
                {items.map((item, i) => (
                  <li key={item.href}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(item)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
                        i === active && "bg-accent"
                      )}
                    >
                      {item.kind === "document" ? (
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{item.label}</span>
                        {item.sub && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.sub}
                          </span>
                        )}
                      </span>
                      {item.badge && (
                        <Badge variant={item.badge.variant}>{item.badge.label}</Badge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
