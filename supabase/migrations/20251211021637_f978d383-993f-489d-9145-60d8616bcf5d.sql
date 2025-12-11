-- Create signup_attempts table for anti-abuse tracking
CREATE TABLE public.signup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  email text,
  created_at timestamptz DEFAULT now(),
  success boolean DEFAULT false,
  user_agent text,
  blocked boolean DEFAULT false
);

-- Enable RLS
ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage all attempts
CREATE POLICY "Admins can manage signup attempts"
ON public.signup_attempts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert (for edge function/anonymous signup checking)
CREATE POLICY "Service role can insert signup attempts"
ON public.signup_attempts
FOR INSERT
WITH CHECK (true);

-- Create index for faster IP lookups
CREATE INDEX idx_signup_attempts_ip_created ON public.signup_attempts(ip_address, created_at DESC);

-- Create function to check signup abuse
CREATE OR REPLACE FUNCTION public.check_signup_abuse(p_ip_address text, p_max_attempts integer DEFAULT 3)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_count integer;
BEGIN
  -- Count successful signups from this IP in the last 24 hours
  SELECT COUNT(*) INTO attempt_count
  FROM public.signup_attempts
  WHERE ip_address = p_ip_address
    AND created_at > now() - interval '24 hours'
    AND success = true;
  
  -- Return true if under limit, false if should be blocked
  RETURN attempt_count < p_max_attempts;
END;
$$;

-- Create function to record signup attempt
CREATE OR REPLACE FUNCTION public.record_signup_attempt(
  p_ip_address text,
  p_email text,
  p_success boolean,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.signup_attempts (ip_address, email, success, user_agent)
  VALUES (p_ip_address, p_email, p_success, p_user_agent);
END;
$$;