import type { Metadata } from "next";
import { Brand } from "@/components/brand";

export const metadata: Metadata = {
  title: "Privacy Policy | Knct’d",
  description: "Privacy Policy for the Knct’d mobile app and getknctd.com.",
};

export default function PrivacyPage() {
  return (
    <main className="shell legalPage">
      <div className="topbar">
        <Brand />
      </div>

      <div className="eyebrow">Legal</div>
      <h1 className="heroTitle">Privacy Policy</h1>
      <p className="heroCopy">Effective October 3, 2026</p>

      <section className="card sectionGap legalCard">
        <p>
          Knct’d (“KNCT,” “we,” “us,” or “our”) provides tools for sharing contact
          information, organizing professional connections, and sending follow-up
          communications. This Privacy Policy explains how we collect, use, disclose,
          and protect information when you use the KNCT mobile app, our websites,
          including getknctd.com, and related services (collectively, the “Services”).
        </p>

        <h2>Information we collect</h2>

        <h3>Account and profile information</h3>
        <p>
          When you create or use a KNCT account, we may collect your name, email
          address, phone number, company, job title, website, profile photo, account
          identifier, and other information you choose to place on your KNCT profile
          or public card.
        </p>

        <h3>Connection information</h3>
        <p>
          When someone connects with a KNCT user, we may collect the information that
          person submits, such as first and last name, email address, phone number,
          and consent choices. We also store information associated with the
          introduction, such as the date, selected follow-up mode, and event details.
        </p>

        <h3>Messages and other content</h3>
        <p>
          We may store follow-up email and text-message content, templates, email
          signatures, event names and locations, event dates, and other content you
          create or provide through the Services.
        </p>

        <h3>Connected email accounts</h3>
        <p>
          If you connect Gmail or Outlook, KNCT receives the email address associated
          with the connected account and authorization credentials needed to send
          messages on your behalf. KNCT requests sending access and basic account
          details needed to identify the connected mailbox. KNCT does not request
          permission to read your inbox. Authorization credentials are stored
          securely and are removed or made unusable when you disconnect the mailbox
          or revoke access with the provider.
        </p>

        <h3>Photos</h3>
        <p>
          If you choose a profile photo, KNCT processes and stores that image so it
          can appear on your profile or public card. KNCT does not require access to
          your entire photo library beyond the photo-selection functionality you
          choose to use.
        </p>

        <h3>Purchases and subscriptions</h3>
        <p>
          If you purchase a KNCT subscription through an app store, we may receive
          information about the subscription, such as product or plan, subscription
          status, renewal or expiration information, and related transaction status.
          We do not receive your full payment-card number from Apple or other app
          stores.
        </p>

        <h3>Technical and service information</h3>
        <p>
          We and our service providers may process technical information needed to
          operate, secure, troubleshoot, and improve the Services, such as request
          logs, authentication events, service errors, and security-related
          information. KNCT does not use this information for cross-app advertising
          tracking.
        </p>

        <h2>How we use information</h2>
        <ul>
          <li>Authenticate users and maintain KNCT accounts.</li>
          <li>Create and display profiles and public contact cards.</li>
          <li>Save, organize, and display professional connections.</li>
          <li>Schedule and send follow-up emails and text messages at the user’s direction.</li>
          <li>Connect supported email accounts and send messages through those accounts.</li>
          <li>Provide subscription features and manage plan entitlements.</li>
          <li>Operate, secure, debug, maintain, and improve the Services.</li>
          <li>Comply with legal obligations and enforce our terms and policies.</li>
        </ul>

        <h2>How we disclose information</h2>
        <p>
          We do not sell personal information and do not use personal information for
          targeted advertising or cross-app tracking. We may disclose information to
          service providers that process data on our behalf when necessary to provide
          the Services, including:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> for authentication, database, and file-storage
            infrastructure.
          </li>
          <li>
            <strong>RevenueCat</strong> for subscription and entitlement management.
          </li>
          <li>
            <strong>Apple</strong> and applicable app-store providers for in-app
            purchases and subscription processing.
          </li>
          <li>
            <strong>Google or Microsoft</strong> when you choose to connect Gmail or
            Outlook so KNCT can send email through your connected account.
          </li>
          <li>
            <strong>Twilio</strong> when text-message functionality is enabled and
            used.
          </li>
          <li>
            Hosting, security, and infrastructure providers that help us operate the
            Services.
          </li>
        </ul>
        <p>
          We may also disclose information when required by law, to protect the
          rights and safety of KNCT, our users, or others, or as part of a merger,
          acquisition, financing, or sale of all or part of our business, subject to
          applicable law.
        </p>

        <h2>Public cards and information shared with other people</h2>
        <p>
          A KNCT public card is designed to share professional contact information.
          Information you place on a public card may be visible to anyone who has the
          card link or QR code. When a visitor submits their information through a
          public card, that information is shared with the KNCT user whose card they
          are connecting with.
        </p>

        <h2>Email and text-message follow-ups</h2>
        <p>
          KNCT may send follow-up communications only as configured by the KNCT user
          and, where applicable, based on the recipient’s consent. Text-message
          recipients may opt out by replying STOP. Message and data rates may apply.
        </p>

        <h2>Data retention</h2>
        <p>
          We retain personal information for as long as reasonably necessary to
          provide the Services, maintain your account, comply with legal obligations,
          resolve disputes, and enforce agreements. Retention periods may vary based
          on the type of information and why we process it. Connected-mailbox
          authorization credentials are no longer used after the mailbox is
          disconnected or access is revoked.
        </p>

        <h2>Your choices and rights</h2>
        <p>
          You may update profile information in the app and disconnect a connected
          email account at any time. Depending on where you live, you may also have
          rights to request access to, correction of, deletion of, or a copy of your
          personal information, or to object to or restrict certain processing.
        </p>
        <p>
          To make a privacy request or request account deletion, contact us at{" "}
          <a href="mailto:privacy@getknctd.com">privacy@getknctd.com</a>. We may need
          to verify your identity before completing a request.
        </p>

        <h2>Security</h2>
        <p>
          We use reasonable administrative, technical, and organizational safeguards
          designed to protect personal information. No method of transmission or
          storage is completely secure, so we cannot guarantee absolute security.
        </p>

        <h2>Children’s privacy</h2>
        <p>
          The Services are not directed to children under 13, and we do not knowingly
          collect personal information from children under 13. If you believe a child
          has provided personal information to us, contact us so we can take
          appropriate action.
        </p>

        <h2>International processing</h2>
        <p>
          Our service providers may process information in the United States and
          other countries. Where required, we use appropriate safeguards for
          international transfers of personal information.
        </p>

        <h2>Changes to this Privacy Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. If we make changes, we
          will update the effective date above and, when required, provide additional
          notice.
        </p>

        <h2>Contact us</h2>
        <p>
          Questions or requests about privacy can be sent to{" "}
          <a href="mailto:privacy@getknctd.com">privacy@getknctd.com</a>.
        </p>
      </section>

      <footer className="legalFooter">
        <span>© 2026 Knct’d</span>
        <a href="/">Back to Knct’d</a>
      </footer>
    </main>
  );
}
