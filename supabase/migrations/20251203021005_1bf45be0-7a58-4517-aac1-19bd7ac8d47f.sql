-- Adicionar campo model_used para rastrear qual modelo foi usado
ALTER TABLE public.analysis_usage ADD COLUMN IF NOT EXISTS model_used TEXT DEFAULT 'google/gemini-2.5-flash';

-- Criar índice para queries de custo por modelo
CREATE INDEX IF NOT EXISTS idx_analysis_usage_model ON public.analysis_usage(model_used);

-- Criar índice para queries de custo por data
CREATE INDEX IF NOT EXISTS idx_analysis_usage_date ON public.analysis_usage(created_at DESC);