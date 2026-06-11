import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/refunds")({
  head: () => ({
    meta: [
      { title: "Refund Policy — Hypeforce" },
      { name: "description", content: "Hypeforce 30-day money-back guarantee, operated by Freedom Noble." },
    ],
  }),
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <article>
      <h1>Refund Policy</h1>
      <p><em>Last updated: June 11, 2026</em></p>

      <p>
        Hypeforce is operated by <strong>Freedom Noble</strong>. We want you to be happy with
        your subscription.
      </p>

      <h2>30-day money-back guarantee</h2>
      <p>
        If you are not satisfied with your purchase, you can request a full refund within{" "}
        <strong>30 days</strong> of your order date. This applies to first-time purchases of any
        paid plan.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Refunds are processed by our payment provider, <strong>Paddle</strong>, who is the
        Merchant of Record for your purchase. To request a refund:
      </p>
      <ul>
        <li>
          Visit <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a>{" "}
          and look up your order using the email address you used at checkout, or
        </li>
        <li>
          Email our support team at <a href="mailto:support@hypeforce.io">support@hypeforce.io</a>{" "}
          and we will help you process the refund.
        </li>
      </ul>

      <h2>Cancellations</h2>
      <p>
        You can cancel your subscription at any time from your account settings or via the
        Paddle customer portal linked from your receipt. After cancellation you keep access until
        the end of the current billing period; you will not be charged again.
      </p>

      <h2>Renewals</h2>
      <p>
        Refund requests for automatic renewals are reviewed on a case-by-case basis. If you
        contact us promptly after a renewal charge and have made little or no use of the new
        period, we will normally issue a refund.
      </p>

      <h2>Refunds for service issues</h2>
      <p>
        If the Service is materially defective or unavailable for an extended period and we
        cannot resolve the issue, you may be entitled to a refund regardless of the 30-day
        window. Contact us and we will work with you in good faith.
      </p>

      <h2>Contact</h2>
      <p>
        Freedom Noble — <a href="mailto:support@hypeforce.io">support@hypeforce.io</a>.
      </p>
    </article>
  );
}
