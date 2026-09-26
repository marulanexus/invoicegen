import type { Metadata } from "next";

import { LegalPage } from "@/components/legal";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms governing your use of InvoiceGen.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      lastUpdated="June 12, 2026"
      intro="These Terms & Conditions (“Terms”) govern your access to and use of InvoiceGen (the “Service”). By creating an account or using the Service, you agree to these Terms. Please read them carefully."
    >
      <h2>1. Acceptance of terms</h2>
      <p>
        By accessing or using the Service you confirm that you can form a
        binding contract, that you accept these Terms, and that you agree to
        comply with them. If you are using the Service on behalf of an
        organization, you represent that you are authorized to bind that
        organization.
      </p>

      <h2>2. Definitions</h2>
      <ul>
        <li>
          <strong>“Account”</strong> — your registered workspace on the Service.
        </li>
        <li>
          <strong>“Your Content”</strong> — the data you submit, including
          client details, line items and documents.
        </li>
        <li>
          <strong>“Subscription”</strong> — a paid plan billed on a recurring
          basis.
        </li>
      </ul>

      <h2>3. Accounts &amp; eligibility</h2>
      <p>
        You must provide accurate information and keep your credentials secure.
        You are responsible for all activity under your Account. You must be at
        least 16 years old to use the Service. Notify us promptly of any
        unauthorized use.
      </p>

      <h2>4. Plans, billing &amp; cancellation</h2>
      <ul>
        <li>
          <strong>Free plan</strong> — provided at no cost with usage limits
          (for example, a capped number of clients and monthly documents).
        </li>
        <li>
          <strong>Paid plans</strong> — billed monthly in advance through our
          payment processor. Fees are stated at checkout and may exclude
          applicable taxes.
        </li>
        <li>
          <strong>Renewals</strong> — Subscriptions renew automatically until
          cancelled. You can cancel anytime from billing settings; access
          continues until the end of the current period.
        </li>
        <li>
          <strong>Refunds</strong> — except where required by law, fees are
          non-refundable. We may change pricing with reasonable notice.
        </li>
      </ul>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for unlawful, fraudulent or deceptive purposes.</li>
        <li>Send spam or content you are not authorized to send.</li>
        <li>
          Infringe intellectual property or privacy rights, or upload malicious
          code.
        </li>
        <li>
          Attempt to gain unauthorized access to, disrupt, or reverse-engineer
          the Service.
        </li>
        <li>Resell or misrepresent the Service.</li>
      </ul>

      <h2>6. Your content &amp; data</h2>
      <p>
        You retain all ownership of Your Content. You grant us a limited license
        to host, process and transmit Your Content solely to operate and provide
        the Service (for example, generating PDFs and sending emails on your
        behalf). You are responsible for the accuracy and legality of Your
        Content and for obtaining any necessary consents from your own clients.
      </p>

      <h2>7. Invoicing &amp; compliance disclaimer</h2>
      <p>
        InvoiceGen is a software tool and does <strong>not</strong> provide
        legal, tax, accounting or financial advice. You are solely responsible
        for ensuring that your invoices, numbering, tax treatment and records
        comply with the laws and regulations applicable to your business and
        jurisdiction. We recommend consulting a qualified professional where
        appropriate.
      </p>

      <h2>8. Intellectual property</h2>
      <p>
        The Service, including its software, design and trademarks, is owned by
        us and our licensors and is protected by intellectual property laws. We
        grant you a limited, non-exclusive, non-transferable right to use the
        Service in accordance with these Terms.
      </p>

      <h2>9. Third-party services</h2>
      <p>
        The Service integrates with third-party providers (such as
        authentication, payment, email and storage providers). Your use of those
        integrations may be subject to their terms, and we are not responsible
        for third-party services.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        The Service is provided <strong>“as is”</strong> and{" "}
        <strong>“as available”</strong> without warranties of any kind, whether
        express or implied, including merchantability, fitness for a particular
        purpose and non-infringement. We do not warrant that the Service will be
        uninterrupted, error-free or secure.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we will not be liable for any
        indirect, incidental, special, consequential or punitive damages, or for
        lost profits, revenues, data or goodwill. Our total liability arising out
        of or relating to the Service will not exceed the greater of the amounts
        you paid to us in the twelve months preceding the claim or USD 100.
      </p>

      <h2>12. Indemnification</h2>
      <p>
        You agree to indemnify and hold us harmless from claims, damages and
        expenses arising from Your Content, your use of the Service, or your
        violation of these Terms or applicable law.
      </p>

      <h2>13. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate
        your access if you breach these Terms or to comply with law. Upon
        termination, your right to use the Service ceases; provisions that by
        their nature should survive will survive.
      </p>

      <h2>14. Changes to these terms</h2>
      <p>
        We may update these Terms from time to time. We will post the updated
        Terms here and revise the “Last updated” date. Your continued use of the
        Service after changes take effect constitutes acceptance.
      </p>

      <h2>15. Governing law</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which we are
        established, without regard to conflict-of-law principles. Courts of
        that jurisdiction will have exclusive jurisdiction, subject to any
        mandatory consumer protections in your country of residence.
      </p>

      <h2>16. Contact</h2>
      <p>
        Questions about these Terms? Email{" "}
        <a href="mailto:support@invoicegen.app">support@invoicegen.app</a>.
      </p>
    </LegalPage>
  );
}
