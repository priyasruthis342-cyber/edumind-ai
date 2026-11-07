/*
# Add daily Rs.1 payment recording function

1. New Functions
- `record_daily_payment(p_reference text)`: records today's Rs.1 (100 paise) daily plan payment for the signed-in user. Idempotent per day: a second call on the same day does nothing and returns true.

2. Security
- SECURITY DEFINER with a fixed search_path.
- EXECUTE revoked from PUBLIC and anon; granted only to authenticated.
- The payments table stays read-only for clients; this function is the only writer.

3. Important Notes
- This is the payment hook. A real gateway (e.g. Razorpay) must confirm payment server-side before calling this function. Until that is connected, the function accepts the client-reported reference.
*/

CREATE OR REPLACE FUNCTION public.record_daily_payment(p_reference text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF p_reference IS NULL OR char_length(p_reference) < 4 OR char_length(p_reference) > 100 THEN
    RAISE EXCEPTION 'Invalid payment reference';
  END IF;

  INSERT INTO payments (user_id, amount_paise, paid_on, reference)
  VALUES (auth.uid(), 100, current_date, p_reference)
  ON CONFLICT (user_id, paid_on) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_daily_payment(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_daily_payment(text) TO authenticated;
