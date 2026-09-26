import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

export function formatDate(
  value: string | Date | null | undefined,
  pattern = "MMM d, yyyy"
): string {
  const d = toDate(value);
  return d ? format(d, pattern) : "—";
}

export function formatRelative(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : "—";
}

export type DocStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partial"
  | "paid"
  | "overdue"
  | "void"
  | "accepted"
  | "declined";

export const STATUS_META: Record<
  DocStatus,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  viewed: { label: "Viewed", variant: "default" },
  partial: { label: "Partial", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  overdue: { label: "Overdue", variant: "destructive" },
  void: { label: "Void", variant: "outline" },
  accepted: { label: "Accepted", variant: "success" },
  declined: { label: "Declined", variant: "destructive" },
};

export function statusMeta(status: string) {
  return STATUS_META[status as DocStatus] ?? { label: status, variant: "secondary" as const };
}

/** Initials for avatars / fallbacks. */
export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
