
-- User subscriptions table
CREATE TABLE public.user_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free',
  weekly_scan_limit INTEGER NOT NULL DEFAULT 3,
  scans_this_week INTEGER NOT NULL DEFAULT 0,
  week_reset_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (date_trunc('week', now()) + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.user_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription" ON public.user_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" ON public.user_subscriptions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Function to check and increment scan count (resets weekly)
CREATE OR REPLACE FUNCTION public.check_and_increment_scan()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub RECORD;
  result JSON;
BEGIN
  -- Upsert subscription if not exists
  INSERT INTO public.user_subscriptions (user_id)
  VALUES (auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO sub FROM public.user_subscriptions WHERE user_id = auth.uid();

  -- Reset weekly counter if needed
  IF now() >= sub.week_reset_at THEN
    UPDATE public.user_subscriptions
    SET scans_this_week = 0, week_reset_at = date_trunc('week', now()) + interval '7 days'
    WHERE user_id = auth.uid();
    sub.scans_this_week := 0;
  END IF;

  -- Check limit for free users
  IF sub.tier = 'free' AND sub.scans_this_week >= sub.weekly_scan_limit THEN
    RETURN json_build_object('allowed', false, 'remaining', 0, 'tier', sub.tier, 'limit', sub.weekly_scan_limit);
  END IF;

  -- Increment
  UPDATE public.user_subscriptions
  SET scans_this_week = scans_this_week + 1, updated_at = now()
  WHERE user_id = auth.uid();

  RETURN json_build_object(
    'allowed', true,
    'remaining', GREATEST(sub.weekly_scan_limit - sub.scans_this_week - 1, 0),
    'tier', sub.tier,
    'limit', sub.weekly_scan_limit
  );
END;
$$;

-- Function to get subscription info
CREATE OR REPLACE FUNCTION public.get_subscription_info()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub RECORD;
BEGIN
  INSERT INTO public.user_subscriptions (user_id)
  VALUES (auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO sub FROM public.user_subscriptions WHERE user_id = auth.uid();

  -- Reset weekly counter if needed
  IF now() >= sub.week_reset_at THEN
    UPDATE public.user_subscriptions
    SET scans_this_week = 0, week_reset_at = date_trunc('week', now()) + interval '7 days'
    WHERE user_id = auth.uid();
    sub.scans_this_week := 0;
  END IF;

  RETURN json_build_object(
    'tier', sub.tier,
    'scans_used', sub.scans_this_week,
    'scan_limit', sub.weekly_scan_limit,
    'scans_remaining', GREATEST(sub.weekly_scan_limit - sub.scans_this_week, 0),
    'is_premium', sub.tier != 'free'
  );
END;
$$;
