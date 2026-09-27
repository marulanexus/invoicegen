import type { Client, ClientInput } from '@invoicegen/shared/api';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, ErrorView, Field, Loading, Screen, Section, T } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useClient, useSaveClient } from '@/lib/queries';

type Form = { name: string; companyName: string; email: string; phone: string; addressLine1: string; city: string; postalCode: string; taxId: string };

const EMPTY: Form = { name: '', companyName: '', email: '', phone: '', addressLine1: '', city: '', postalCode: '', taxId: '' };

function fromClient(c: Client): Form {
  return {
    name: c.name,
    companyName: c.companyName ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    addressLine1: c.addressLine1 ?? '',
    city: c.city ?? '',
    postalCode: c.postalCode ?? '',
    taxId: c.taxId ?? '',
  };
}

/**
 * The update endpoint replaces the whole client, so carry over every field this
 * form doesn't show (website, notes, tags…) unchanged.
 */
function toInput(form: Form, existing?: Client): ClientInput & Record<string, unknown> {
  const keep = existing
    ? {
        contactName: existing.contactName ?? undefined,
        website: existing.website ?? undefined,
        addressLine2: existing.addressLine2 ?? undefined,
        state: existing.state ?? undefined,
        country: existing.country ?? undefined,
        currency: existing.currency ?? undefined,
        taxRate: existing.taxRate != null ? Number(existing.taxRate) : undefined,
        notes: existing.notes ?? undefined,
        tags: existing.tags,
      }
    : { country: 'ZA' };
  return { ...keep, ...form, name: form.name.trim() };
}

function ClientForm({ existing }: { existing?: Client }) {
  const save = useSaveClient(existing?.id);
  const [form, setForm] = useState<Form>(existing ? fromClient(existing) : EMPTY);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const err = (k: keyof Form) => (save.error instanceof ApiError ? save.error.fieldErrors?.[k]?.[0] : undefined);

  function submit() {
    save.mutate(toInput(form, existing), {
      onSuccess: (client) => (existing ? router.back() : router.replace(`/clients/${client.id}`)),
    });
  }

  return (
    <Screen footer={<Button label={existing ? 'Save changes' : 'Add client'} onPress={submit} loading={save.isPending} disabled={!form.name.trim()} />}>
      <Field label="Name" value={form.name} onChangeText={set('name')} error={err('name')} placeholder="Person or business name" autoFocus={!existing} />
      <Field label="Company (optional)" value={form.companyName} onChangeText={set('companyName')} />
      <Section title="Contact">
        <Field label="Mobile number" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" hint="Used to send invoices on WhatsApp." />
        <Field label="Email" value={form.email} onChangeText={set('email')} error={err('email')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      </Section>
      <Section title="Billing details">
        <Field label="Street address" value={form.addressLine1} onChangeText={set('addressLine1')} />
        <Field label="City" value={form.city} onChangeText={set('city')} />
        <Field label="Postal code" value={form.postalCode} onChangeText={set('postalCode')} keyboardType="number-pad" />
        <Field label="VAT number (optional)" value={form.taxId} onChangeText={set('taxId')} autoCapitalize="characters" />
      </Section>
      {save.isError && !(save.error instanceof ApiError && save.error.fieldErrors) ? <T tone="danger">{save.error.message}</T> : null}
    </Screen>
  );
}

/** Add a client, or edit one with `?id=`. */
export default function ClientFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useClient(id ?? '');

  if (!id) return <ClientForm />;
  if (existing.isPending) return <Loading />;
  if (existing.isError) {
    return (
      <Screen>
        <ErrorView message={existing.error.message} onRetry={() => existing.refetch()} />
      </Screen>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: 'Edit client' }} />
      <ClientForm existing={existing.data} />
    </>
  );
}
