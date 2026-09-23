import { PageHeader } from "@/components/app/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";

export const metadata = { title: "Settings" };

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" description="Manage your business, billing and team." />
      <SettingsNav />
      <div className="py-6">{children}</div>
    </div>
  );
}
