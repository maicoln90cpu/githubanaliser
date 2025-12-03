-- Drop the existing constraint and add the new one with all analysis types (including legacy 'melhorias')
ALTER TABLE public.analyses DROP CONSTRAINT IF EXISTS analyses_type_check;
ALTER TABLE public.analyses ADD CONSTRAINT analyses_type_check 
  CHECK (type = ANY (ARRAY['prd', 'divulgacao', 'captacao', 'seguranca', 'ui_theme', 'ferramentas', 'features', 'melhorias']));