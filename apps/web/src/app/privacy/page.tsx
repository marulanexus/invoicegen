import type { Metadata } from "next";

import { LegalPage } from "@/components/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How InvoiceGen collects, uses, shares and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="June 12, 2026"
      intro="This Privacy Policy explains how InvoiceGen (“we”, “us”, “our”) collects, uses, discloses and safeguards your information when you use our invoicing platform and related services (the “Service”). We are committed to protecting your privacy and handling your data transparently."
    >
      <h2>1. Who we are</h2>
      <p>
        InvoiceGen provides software that helps freelancers, sole traders,
        consultants and small businesses create, send and manage invoices,
        quotes and receipts. For the purposes of data protection law (including
        the EU/UK GDPR), we act as a <strong>data controller</strong> for your
        account information and as a <strong>data processor</strong> for the
        client and document data you enter into the Service on behalf of your
        own customers.
      </p>

      <h2>2. Information we collect</h2>
      <h3>Information you provide</h3>
      <ul>
        <li>
          <strong>Account details</strong> — name, email address and
          authentication data, managed through our authentication provider.
        </li>
        <li>
          <strong>Business profile</strong> — business name, address, logo, tax
          identifiers, currency and document settings.
        </li>
        <li>
          <strong>Client &amp; document data</strong> — the contacts, line
          items, notes and amounts you enter to create invoices, quotes and
          receipts.
        </li>
        <li>
          <strong>Payment records</strong> — payments you manually record
          against documents.
        </li>
        <li>
          <strong>Communications</strong> — messages you send to us for support.
        </li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li>
          <strong>Usage data</strong> — actions taken in the app (e.g. documents
          created, emails sent) used to provide features and enforce plan
          limits.
        </li>
        <li>
          <strong>Device &amp; log data</strong> — IP address, browser type and
          access times, used for security and diagnostics.
        </li>
        <li>
          <strong>Cookies</strong> — strictly necessary cookies for
          authentication and session management. We do not use advertising
          cookies.
        </li>
      </ul>

      <h2>3. How we use your information</h2>
      <ul>
        <li>To provide, operate and maintain the Service.</li>
        <li>To generate and deliver your invoices, quotes and receipts.</li>
        <li>To process subscriptions and enforce plan entitlements.</li>
        <li>To send transactional and service-related communications.</li>
        <li>To secure the Service and prevent fraud or abuse.</li>
        <li>To comply with legal and accounting obligations.</li>
      </ul>

      <h2>4. Legal bases for processing</h2>
      <p>
        Where the GDPR applies, we rely on the following legal bases:{" "}
        <strong>performance of a contract</strong> (to provide the Service),{" "}
        <strong>legitimate interests</strong> (to secure and improve the
        Service), <strong>consent</strong> (where required, e.g. optional
        communications), and <strong>legal obligation</strong> (e.g. tax and
        accounting records).
      </p>

      <h2>5. How we share information</h2>
      <p>
        We do not sell your personal data. We share information only with
        sub-processors that help us operate the Service, under appropriate data
        protection terms:
      </p>
      <ul>
        <li>
          <strong>Authentication</strong> (Clerk) — to manage sign-in and
          organizations.
        </li>
        <li>
          <strong>Database &amp; hosting</strong> (Neon, Vercel) — to store and
          serve your data.
        </li>
        <li>
          <strong>Payments</strong> (Stripe) — to process subscription billing.
          We never store full card numbers.
        </li>
        <li>
          <strong>Email delivery</strong> (Resend, or your own SMTP provider if
          configured) — to send documents and notifications.
        </li>
        <li>
          <strong>File storage</strong> (where configured) — to store logos and
          generated PDFs.
        </li>
      </ul>
      <p>
        We may also disclose information where required by law or to protect our
        rights, users and the public.
      </p>

      <h2>6. Data retention</h2>
      <p>
        We retain your information for as long as your account is active and as
        needed to provide the Service. Financial documents may be retained
        longer to meet legal and accounting requirements. When you delete data
        or close your account, associated records are deleted or anonymized,
        subject to backup rotation and legal retention periods.
      </p>

      <h2>7. Security</h2>
      <p>
        We implement technical and organizational measures to protect your
        data, including encryption in transit, tenant isolation, encrypted
        storage of sensitive credentials (such as SMTP passwords), access
        controls and audit logging. No method of transmission or storage is
        completely secure, but we work continuously to protect your information.
      </p>

      <h2>8. Your rights</h2>
      <p>
        Depending on your location, you may have the right to access, correct,
        delete, restrict or object to the processing of your personal data, to
        data portability, and to withdraw consent. To exercise these rights,
        contact us at{" "}
        <a href="mailto:privacy@invoicegen.app">privacy@invoicegen.app</a>. You
        also have the right to lodge a complaint with your local data protection
        authority.
      </p>

      <h2>9. International transfers</h2>
      <p>
        Your data may be processed in countries other than your own. Where data
        is transferred internationally, we rely on appropriate safeguards such
        as standard contractual clauses provided by our sub-processors.
      </p>

      <h2>10. Children&apos;s privacy</h2>
      <p>
        The Service is not directed to individuals under 16, and we do not
        knowingly collect personal data from children.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will post the
        revised version here and update the “Last updated” date. Material changes
        will be communicated where appropriate.
      </p>

      <h2>12. Contact us</h2>
      <p>
        Questions about this policy or your data? Email{" "}
        <a href="mailto:privacy@invoicegen.app">privacy@invoicegen.app</a>.
      </p>
    </LegalPage>
  );
}
