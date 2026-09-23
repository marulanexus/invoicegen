import {
  BarChart3,
  Calendar,
  CreditCard,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Quotes", href: "/quotes", icon: FileSpreadsheet },
  { label: "Receipts", href: "/receipts", icon: Receipt },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];
