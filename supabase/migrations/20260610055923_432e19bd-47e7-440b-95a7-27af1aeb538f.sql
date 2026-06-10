-- Track monthly credit grants per subscription period for idempotency
CREATE TABLE public.subscription_credit_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  credits_granted integer NOT NULL,
  grant_id uuid REFERENCES public.credit_grants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, period_start)
);

GRANT SELECT ON public.subscription_credit_periods TO authenticated;
GRANT ALL ON public.subscription_credit_periods TO service_role;

ALTER TABLE public.subscription_credit_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their subscription periods"
  ON public.subscription_credit_periods FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.id = subscription_credit_periods.subscription_id
      AND s.user_id = auth.uid()
  ));

-- Allow nullable source values via existing 'source' text column on credit_grants;
-- new source we'll use: 'subscription'

-- Add unique constraint on subscriptions.user_id is NOT desired (users can re-subscribe).
-- No schema change needed there.