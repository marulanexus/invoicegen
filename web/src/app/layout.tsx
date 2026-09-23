import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";
import { ThemeProvider, themeNoFlashScript } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { isClerkConfigured } from "@/lib/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "InvoiceGen — Invoices, quotes & receipts for small business",
    template: "%s · InvoiceGen",
  },
  description:
    "Create, send and get paid on beautiful invoices, quotes and receipts. Built for freelancers, consultants and small businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const tree = (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          // No-flash dark mode: runs before first paint.
          dangerouslySetInnerHTML={{ __html: themeNoFlashScript }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );

  // Only mount Clerk when keys are present so the public site renders during
  // initial local setup (before the developer has added Clerk credentials).
  return isClerkConfigured ? (
    <ClerkProvider afterSignOutUrl="/">{tree}</ClerkProvider>
  ) : (
    tree
  );
}
