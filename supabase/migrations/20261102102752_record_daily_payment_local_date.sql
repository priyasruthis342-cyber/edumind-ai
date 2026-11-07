/*
# Pass the student's local date into the daily payment function

1. Changed Functions
- `record_daily_payment(p_reference text, p_paid_on date)` replaces the earlier single-argument version so the day of payment matches the student's local calendar instead of the server clock.
- The date must be within one day of the server date to prevent backdating or pre-paying.

2. Security
- SECURITY DEFINER with a fixed search_path.
- EXECUTE revoked from PUBLIC and anon; granted only to authenticated.

3. Important Notes
- The older one-argument function is removed. It was created minutes earlier and is not used by any data, so no records are affected.
- Payments are still one per user per day (unique constraint).
*/

DROP FUNCTION IF EXISTS public.record_daily_payment(text);

CREATE OR REPLACE FUNCTION public.record_daily_payment(p_reference text, p_paid_on date)
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
  IF p_paid_on IS NULL OR abs(p_paid_on - current_date) > 1 THEN
    RAISE EXCEPTION 'Invalid payment date';
  END IF;

  INSERT INTO payments (user_id, amount_paise, paid_on, reference)
  VALUES (auth.uid(), 100, p_paid_on, p_reference)
  ON CONFLICT (user_id, paid_on) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_daily_payment(text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_daily_payment(text, date) TO authenticated;
