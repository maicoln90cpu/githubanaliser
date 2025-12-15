-- Create rate_limits table for tracking API usage
CREATE TABLE public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  requests_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index for user+endpoint combination
CREATE UNIQUE INDEX idx_rate_limits_user_endpoint ON public.rate_limits (user_id, endpoint);

-- Create index for cleanup queries
CREATE INDEX idx_rate_limits_window_start ON public.rate_limits (window_start);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role has full access (edge functions use service role)
CREATE POLICY "Service role has full access to rate_limits"
ON public.rate_limits
FOR ALL
USING (true)
WITH CHECK (true);

-- Function to check and increment rate limit
-- Returns: true if allowed, false if rate limited
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_max_requests INTEGER DEFAULT 10,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_count INTEGER;
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_window_cutoff TIMESTAMP WITH TIME ZONE;
  v_remaining INTEGER;
  v_reset_at TIMESTAMP WITH TIME ZONE;
BEGIN
  v_window_cutoff := now() - (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Try to get existing rate limit record
  SELECT requests_count, window_start
  INTO v_current_count, v_window_start
  FROM public.rate_limits
  WHERE user_id = p_user_id AND endpoint = p_endpoint;
  
  -- If no record exists or window expired, create/reset
  IF v_current_count IS NULL OR v_window_start < v_window_cutoff THEN
    INSERT INTO public.rate_limits (user_id, endpoint, requests_count, window_start)
    VALUES (p_user_id, p_endpoint, 1, now())
    ON CONFLICT (user_id, endpoint) 
    DO UPDATE SET requests_count = 1, window_start = now();
    
    v_remaining := p_max_requests - 1;
    v_reset_at := now() + (p_window_minutes || ' minutes')::INTERVAL;
    
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', v_remaining,
      'limit', p_max_requests,
      'reset_at', v_reset_at
    );
  END IF;
  
  -- Window still active, check if under limit
  IF v_current_count >= p_max_requests THEN
    v_remaining := 0;
    v_reset_at := v_window_start + (p_window_minutes || ' minutes')::INTERVAL;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', v_remaining,
      'limit', p_max_requests,
      'reset_at', v_reset_at,
      'retry_after_seconds', EXTRACT(EPOCH FROM (v_reset_at - now()))::INTEGER
    );
  END IF;
  
  -- Increment counter
  UPDATE public.rate_limits
  SET requests_count = requests_count + 1
  WHERE user_id = p_user_id AND endpoint = p_endpoint;
  
  v_remaining := p_max_requests - (v_current_count + 1);
  v_reset_at := v_window_start + (p_window_minutes || ' minutes')::INTERVAL;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', v_remaining,
    'limit', p_max_requests,
    'reset_at', v_reset_at
  );
END;
$$;

-- Function to clean up old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - INTERVAL '2 hours';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;