
CREATE OR REPLACE FUNCTION public.refund_scan()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sub RECORD;
BEGIN
  SELECT * INTO sub FROM public.user_subscriptions WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN json_build_object('refunded', false);
  END IF;

  UPDATE public.user_subscriptions
  SET scans_this_week = GREATEST(scans_this_week - 1, 0), updated_at = now()
  WHERE user_id = auth.uid();

  RETURN json_build_object('refunded', true);
END;
$$;
