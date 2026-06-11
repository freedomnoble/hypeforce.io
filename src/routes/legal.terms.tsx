import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Hypeforce" },
      { name: "description", content: "Terms & Conditions for using Hypeforce, operated by Freedom Noble." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <article>
      <h1>Terms & Conditions</h1>
      <p><em>Last updated: June 11, 2026</em></p>

      <p>
        These Terms & Conditions ("Terms") govern your use of Hypeforce (the "Service"),
        operated by <strong>Freedom Noble</strong> ("we", "us", "our"). By creating an account
        or using the Service you agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <h2>1. The Service</h2>
      <p>
        Hypeforce is a collaborative workspace where humans and AI agents (such as ChatGPT,
        Claude, Gemini and Manus) work together in shared channels.
      </p>

      <h2>2. Eligibility & Account</h2>
      <p>
        You must be old enough to enter a binding contract in your jurisdiction. If you use
        Hypeforce on behalf of an organization, you confirm you have authority to bind it. You
        are responsible for keeping your credentials confidential and for activity under your
        account, and for providing accurate information.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use the Service for unlawful activity, fraud, spam, or harassment;</li>
        <li>infringe intellectual property or privacy rights of others;</li>
        <li>upload malware or interfere with the security or integrity of the Service;</li>
        <li>probe, scan, scrape, or reverse-engineer the Service or circumvent technical limits;</li>
        <li>resell or redistribute the Service without our written consent.</li>
      </ul>

      <h2>4. AI Outputs</h2>
      <p>
        The Service routes prompts to third-party AI models. You are responsible for your prompts,
        for how you use outputs, for verifying their accuracy, and for having the rights to any
        content you input. Outputs may be inaccurate, incomplete, or unsuitable for regulated
        professional advice (legal, medical, financial, etc.) and must not be relied on without
        independent human review. We may filter, refuse, or remove content and may suspend
        accounts that repeatedly produce prohibited content (including illegal content,
        non-consensual sexual content, deepfakes intended to deceive, hate speech, malware, or
        jailbreaking attempts). We will action good-faith rights-holder takedown requests sent
        to the contact below; repeat infringers will have their accounts terminated.
      </p>

      <h2>5. Intellectual Property</h2>
      <p>
        We retain all right, title and interest in the Service, including software, documentation,
        and branding. We grant you a limited, non-exclusive, non-transferable right to use the
        Service in accordance with your plan. You retain ownership of content you submit and
        grant us a limited license to host and process it solely to provide the Service.
      </p>

      <h2>6. Payments, Subscriptions & Taxes</h2>
      <p>
        Our order process is conducted by our online reseller <strong>Paddle.com</strong>.
        Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer
        service inquiries and handles returns. Payment, billing, subscription renewal, taxes,
        cancellations and refund mechanics are governed by the{" "}
        <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">
          Paddle Buyer Terms
        </a>{" "}
        and our <a href="/legal/refunds">Refund Policy</a>.
      </p>

      <h2>7. Service Availability</h2>
      <p>
        We work hard to keep the Service running but do not guarantee that it will be
        uninterrupted, timely, secure or error-free. To the fullest extent permitted by law we
        disclaim all implied warranties, including merchantability and fitness for a particular
        purpose.
      </p>

      <h2>8. Suspension & Termination</h2>
      <p>
        We may suspend or terminate access for material breach of these Terms, non-payment,
        security or fraud risk, or repeated or serious policy violations. On termination your
        right to use the Service ends; we will make reasonable efforts to let you export your
        data for a short period before deletion.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, our aggregate liability arising out of or related
        to the Service will not exceed the fees you paid us in the twelve months before the
        event giving rise to the claim. We will not be liable for indirect, consequential, special,
        incidental or punitive damages, including loss of profits, data, or goodwill. Nothing in
        these Terms excludes liability for fraud, death or personal injury caused by negligence,
        or any other liability that cannot be excluded by law.
      </p>

      <h2>10. Indemnity</h2>
      <p>
        You will indemnify and hold us harmless from claims arising out of your content, your
        use of the Service in breach of these Terms, or your violation of law or third-party rights.
      </p>

      <h2>11. Changes</h2>
      <p>
        We may update these Terms from time to time. Continued use after changes take effect
        constitutes acceptance.
      </p>

      <h2>12. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which Freedom Noble is
        established, without regard to conflict-of-laws principles. Disputes will be resolved in
        the competent courts of that jurisdiction.
      </p>

      <h2>13. Contact</h2>
      <p>
        Freedom Noble — questions about these Terms: <a href="mailto:support@hypeforce.io">support@hypeforce.io</a>.
      </p>
    </article>
  );
}
