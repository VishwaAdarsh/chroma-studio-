-- Chroma Studio — Phase 9 Database Migration
-- Subscriptions & Razorpay Payment Events Data Model with Strict RLS

-- 1. Create public.subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'pro_monthly', 'pro_yearly')),
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'cancelled', 'expired', 'incomplete')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year', 'none')),
  amount_inr NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_subscription_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_rzp_order ON public.subscriptions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_rzp_payment ON public.subscriptions(razorpay_payment_id);

-- 3. Create public.payment_events table for audit & idempotency
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_event_id TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  amount_inr NUMERIC(10, 2),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_provider_event_id UNIQUE (provider_event_id),
  CONSTRAINT unique_payment_id UNIQUE (razorpay_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_events_user_id ON public.payment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_order_id ON public.payment_events(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON public.payment_events(razorpay_payment_id);

-- 4. Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Users can SELECT their own records only.
-- NO INSERT, UPDATE, or DELETE policies exist for authenticated/anon roles.
-- Clients cannot tamper with entitlements or payment logs directly.
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own payment events" ON public.payment_events;
CREATE POLICY "Users can view own payment events"
  ON public.payment_events
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- 6. Helper Function: Check if user is actively Pro
CREATE OR REPLACE FUNCTION public.is_user_pro(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_pro BOOLEAN;
BEGIN
  SELECT (status = 'active' AND current_period_end > timezone('utc'::text, now()))
  INTO v_is_pro
  FROM public.subscriptions
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_is_pro, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_user_pro(UUID) TO authenticated;

-- 7. Trigger to keep public.profiles.role updated with active subscription
CREATE OR REPLACE FUNCTION public.sync_profile_subscription_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.current_period_end > timezone('utc'::text, now()) THEN
    UPDATE public.profiles
    SET role = 'pro', updated_at = timezone('utc'::text, now())
    WHERE id = NEW.user_id;
  ELSE
    UPDATE public.profiles
    SET role = 'user', updated_at = timezone('utc'::text, now())
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_profile_subscription_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_subscription_change ON public.subscriptions;
CREATE TRIGGER on_subscription_change
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_subscription_role();
