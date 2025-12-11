-- Insert default signup limit setting
INSERT INTO public.system_settings (key, value, description)
VALUES ('signup_limit_per_ip', '3', 'Limite de cadastros por IP em 24 horas')
ON CONFLICT (key) DO NOTHING;

-- Update check_signup_abuse function to read from system_settings
CREATE OR REPLACE FUNCTION public.check_signup_abuse(p_ip_address text, p_max_attempts integer DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_count integer;
  max_limit integer;
BEGIN
  -- Get limit from system_settings if not provided
  IF p_max_attempts IS NULL THEN
    SELECT COALESCE(value::integer, 3) INTO max_limit
    FROM public.system_settings
    WHERE key = 'signup_limit_per_ip';
    
    IF max_limit IS NULL THEN
      max_limit := 3; -- fallback default
    END IF;
  ELSE
    max_limit := p_max_attempts;
  END IF;

  -- Count successful signups from this IP in the last 24 hours
  SELECT COUNT(*) INTO attempt_count
  FROM public.signup_attempts
  WHERE ip_address = p_ip_address
    AND created_at > now() - interval '24 hours'
    AND success = true;
  
  -- Return true if under limit, false if should be blocked
  RETURN attempt_count < max_limit;
END;
$$;