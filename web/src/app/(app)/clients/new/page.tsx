import { PageHeader } from "@/components/app/page-header";
import { ClientForm } from "@/components/clients/client-form";

export const metadata = { title: "New client" };

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add client" description="Save details once and reuse them on every document." />
      <ClientForm />
    </div>
  );
}
