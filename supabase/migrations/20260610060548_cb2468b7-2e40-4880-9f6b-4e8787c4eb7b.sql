ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_paddle_sub_id_key;
DROP INDEX IF EXISTS public.subscriptions_paddle_sub_id_key;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_paddle_subscription_id_key UNIQUE (paddle_subscription_id);