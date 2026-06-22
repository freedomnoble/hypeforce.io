import { useState } from "react";
import { initializePaddle, getPaddleEnvironment, setPaddleEventCallback } from "@/lib/paddle";
import { createPaddleCheckoutTransaction } from "@/lib/payments.functions";

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: {
    priceId: string;
    quantity?: number;
    customerEmail?: string;
    customData?: Record<string, string>;
    successUrl?: string;
    onEvent?: (event: any) => void;
  }) => {
    setLoading(true);
    try {
      await initializePaddle();

      // SECURITY: Create the transaction server-side so customData.userId is
      // stamped from the verified JWT, not the browser. The frontend never
      // chooses which user receives the subscription/credits.
      const { transactionId } = await createPaddleCheckoutTransaction({
        data: {
          priceId: options.priceId,
          quantity: options.quantity ?? 1,
          environment: getPaddleEnvironment(),
          customData: options.customData,
        },
      });

      if (options.onEvent) {
        setPaddleEventCallback(options.onEvent);
      }

      window.Paddle.Checkout.open({
        transactionId,
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        settings: {
          displayMode: "overlay",
          successUrl:
            options.successUrl || `${window.location.origin}/app?checkout=success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
