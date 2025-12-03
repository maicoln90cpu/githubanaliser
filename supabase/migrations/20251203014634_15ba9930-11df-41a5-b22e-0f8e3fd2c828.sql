-- Create plans table
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  monthly_analyses INT DEFAULT 0,
  daily_analyses INT DEFAULT 0,
  price_monthly DECIMAL(10,2) DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create user subscriptions table
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_id UUID REFERENCES public.plans(id),
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create analysis usage table for tracking
CREATE TABLE public.analysis_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  tokens_estimated INT DEFAULT 0,
  cost_estimated DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_usage ENABLE ROW LEVEL SECURITY;

-- Plans policies (public read)
CREATE POLICY "Plans are viewable by everyone" 
ON public.plans FOR SELECT USING (true);

CREATE POLICY "Only admins can manage plans" 
ON public.plans FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- User subscriptions policies
CREATE POLICY "Users can view own subscription" 
ON public.user_subscriptions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions" 
ON public.user_subscriptions FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage subscriptions" 
ON public.user_subscriptions FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Analysis usage policies
CREATE POLICY "Users can view own usage" 
ON public.analysis_usage FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage" 
ON public.analysis_usage FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all usage" 
ON public.analysis_usage FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default plans
INSERT INTO public.plans (name, slug, description, monthly_analyses, daily_analyses, price_monthly, features) VALUES
('Free', 'free', 'Plano gratuito para começar', 3, 1, 0, '["3 análises básicas (PRD, Divulgação, Captação)", "1 projeto por dia", "Exportação PDF"]'::jsonb),
('Basic', 'basic', 'Para desenvolvedores independentes', 20, 5, 29.90, '["7 tipos de análise completos", "5 projetos por dia", "Exportação PDF", "Suporte por email"]'::jsonb),
('Pro', 'pro', 'Para times e agências', 100, 15, 79.90, '["Análises ilimitadas*", "15 projetos por dia", "Exportação PDF", "Re-análise individual", "Suporte prioritário", "API access (em breve)"]'::jsonb);

-- Create function to get user's current plan
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id UUID)
RETURNS TABLE (
  plan_id UUID,
  plan_name TEXT,
  plan_slug TEXT,
  monthly_analyses INT,
  daily_analyses INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as plan_id,
    p.name as plan_name,
    p.slug as plan_slug,
    p.monthly_analyses,
    p.daily_analyses
  FROM user_subscriptions us
  JOIN plans p ON p.id = us.plan_id
  WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    AND (us.expires_at IS NULL OR us.expires_at > now())
  ORDER BY us.created_at DESC
  LIMIT 1;
  
  -- If no subscription, return free plan
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      p.id as plan_id,
      p.name as plan_name,
      p.slug as plan_slug,
      p.monthly_analyses,
      p.daily_analyses
    FROM plans p
    WHERE p.slug = 'free'
    LIMIT 1;
  END IF;
END;
$$;

-- Create function to count user's analyses this month
CREATE OR REPLACE FUNCTION public.get_user_monthly_usage(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT project_id)::INT
  FROM analyses a
  JOIN projects p ON p.id = a.project_id
  WHERE p.user_id = p_user_id
    AND a.created_at >= date_trunc('month', now());
$$;

-- Create function to count user's analyses today
CREATE OR REPLACE FUNCTION public.get_user_daily_usage(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT project_id)::INT
  FROM analyses a
  JOIN projects p ON p.id = a.project_id
  WHERE p.user_id = p_user_id
    AND a.created_at >= date_trunc('day', now());
$$;