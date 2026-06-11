import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — Hypeforce" },
      { name: "description", content: "How Hypeforce, operated by Freedom Noble, collects and uses your personal data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <article>
      <h1>Privacy Notice</h1>
      <p><em>Last updated: June 11, 2026</em></p>

      <p>
        This Privacy Notice explains how <strong>Freedom Noble</strong> ("we", "us", "our"),
        the operator of Hypeforce (the "Service"), collects, uses and shares your personal data.
        Freedom Noble is the data controller for personal data processed in connection with the
        Service.
      </p>

      <h2>1. Personal Data We Collect</h2>
      <ul>
        <li><strong>Account data</strong>: name, email address, password hash, profile image.</li>
        <li><strong>Authentication data</strong>: login timestamps, session tokens, OAuth identifiers when you sign in with a third-party provider.</li>
        <li><strong>Workspace content</strong>: messages, channels, files and other content you create or upload to the Service, including prompts you send to AI agents and the resulting outputs.</li>
        <li><strong>Support communications</strong>: messages you send us and information you provide when contacting support.</li>
        <li><strong>Usage and telemetry</strong>: features used, actions taken, error events, performance metrics.</li>
        <li><strong>Device and connection data</strong>: IP address, browser type, operating system, device identifiers, approximate location derived from IP.</li>
        <li><strong>Billing identifiers</strong>: a customer reference returned by our payment provider (Paddle). Card and full billing details are collected and stored by Paddle, not by us.</li>
      </ul>

      <h2>2. How We Use Your Data</h2>
      <ul>
        <li>To create and manage your account and provide the Service (legal basis: performance of a contract).</li>
        <li>To route prompts to third-party AI providers you choose to use (performance of a contract).</li>
        <li>To prevent fraud, abuse and security incidents (legitimate interests).</li>
        <li>To diagnose issues, improve and develop features (legitimate interests).</li>
        <li>To respond to support requests (performance of a contract / legitimate interests).</li>
        <li>To send service announcements and, with your consent where required, product updates (consent / legitimate interests).</li>
        <li>To comply with legal obligations such as tax and accounting (legal obligation).</li>
      </ul>

      <h2>3. Who We Share Data With</h2>
      <ul>
        <li><strong>Service providers / subprocessors</strong>: hosting, database, email delivery, error monitoring, analytics and customer support tooling that operate on our behalf under contract.</li>
        <li><strong>Merchant of Record (Paddle)</strong>: handles the sale of the Service, subscription management, payments, tax compliance and invoicing. See <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">Paddle's Privacy Notice</a>.</li>
        <li><strong>AI providers</strong>: when you invoke an AI agent, the relevant prompt content is sent to that provider (e.g. OpenAI, Anthropic, Google) to generate a response.</li>
        <li><strong>Professional advisers</strong>: lawyers, accountants and auditors under duties of confidentiality.</li>
        <li><strong>Authorities</strong>: where required by law, regulation or valid legal process.</li>
      </ul>

      <h2>4. International Transfers</h2>
      <p>
        Our providers may process data outside your country, including in the United States.
        Where data leaves the UK/EEA we rely on appropriate safeguards such as the European
        Commission's Standard Contractual Clauses or adequacy decisions.
      </p>

      <h2>5. Retention</h2>
      <p>
        We retain personal data for as long as your account is active and as needed to provide
        the Service. When you delete your account, we delete or anonymise personal data within a
        reasonable period, except where we are required to retain it for legal, tax, accounting
        or fraud-prevention purposes.
      </p>

      <h2>6. Your Rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, delete, restrict or
        port your personal data, to object to processing, and to withdraw consent at any time.
        Under the UK GDPR and EU GDPR you also have the right to complain to your supervisory
        authority. We will respond to verified requests within one month.
      </p>

      <h2>7. Security</h2>
      <p>
        We use appropriate technical and organisational measures to protect personal data,
        including encryption in transit, access controls, isolated tenant data, and logging.
        No system is perfectly secure; please use a strong, unique password and notify us
        promptly of any suspected compromise.
      </p>

      <h2>8. Cookies</h2>
      <p>
        We use cookies and similar technologies that are strictly necessary to operate the
        Service (e.g. authentication), plus limited analytics to understand product usage. Where
        required by law we will ask for your consent before using non-essential cookies. You can
        manage cookies in your browser settings.
      </p>

      <h2>9. Children</h2>
      <p>
        The Service is not directed to children under 16 and we do not knowingly collect their
        personal data.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this Privacy Notice from time to time. We will post the updated version
        and adjust the "Last updated" date.
      </p>

      <h2>11. Contact</h2>
      <p>
        Freedom Noble — privacy questions and rights requests:{" "}
        <a href="mailto:privacy@hypeforce.io">privacy@hypeforce.io</a>.
      </p>
    </article>
  );
}
