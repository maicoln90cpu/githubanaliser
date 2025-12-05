-- Add config JSONB column to plans table if not exists
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

-- Clear existing plans and insert with full configuration
DELETE FROM public.plans;

-- Insert Free plan
INSERT INTO public.plans (name, slug, description, monthly_analyses, daily_analyses, price_monthly, features, is_active, config)
VALUES (
  'Free', 
  'free', 
  'Ideal para experimentar a plataforma', 
  3, 
  1, 
  0, 
  '["PRD, Divulgação e Captação", "Profundidade Crítica apenas", "Suporte por email"]'::jsonb,
  true,
  '{
    "allowed_depths": ["critical"],
    "allowed_analysis_types": ["prd", "divulgacao", "captacao"],
    "max_tokens_monthly": 50000,
    "allow_economic_mode": false,
    "limitations": ["Apenas 3 tipos de análise", "Sem modo econômico", "Profundidade limitada"]
  }'::jsonb
);

-- Insert Basic plan
INSERT INTO public.plans (name, slug, description, monthly_analyses, daily_analyses, price_monthly, features, is_active, config)
VALUES (
  'Basic', 
  'basic', 
  'Para desenvolvedores independentes', 
  20, 
  5, 
  29.90, 
  '["Todos os 8 tipos de análise", "Profundidades Crítica e Balanceada", "Exportação PDF", "Suporte prioritário"]'::jsonb,
  true,
  '{
    "allowed_depths": ["critical", "balanced"],
    "allowed_analysis_types": ["prd", "divulgacao", "captacao", "seguranca", "ui_theme", "ferramentas", "features", "documentacao"],
    "max_tokens_monthly": 500000,
    "allow_economic_mode": true,
    "limitations": ["Sem profundidade completa"]
  }'::jsonb
);

-- Insert Pro plan
INSERT INTO public.plans (name, slug, description, monthly_analyses, daily_analyses, price_monthly, features, is_active, config)
VALUES (
  'Pro', 
  'pro', 
  'Para times e empresas', 
  100, 
  15, 
  79.90, 
  '["Análises ilimitadas/mês", "Todos os 8 tipos de análise", "Todas as profundidades", "Modo econômico disponível", "Exportação PDF", "Re-análise com cache", "Suporte 24/7"]'::jsonb,
  true,
  '{
    "allowed_depths": ["critical", "balanced", "complete"],
    "allowed_analysis_types": ["prd", "divulgacao", "captacao", "seguranca", "ui_theme", "ferramentas", "features", "documentacao"],
    "max_tokens_monthly": null,
    "allow_economic_mode": true,
    "limitations": []
  }'::jsonb
);