-- Drop existing constraint
ALTER TABLE analyses DROP CONSTRAINT IF EXISTS analyses_type_check;

-- Add updated constraint with 'performance' and without 'ferramentas' as required type
ALTER TABLE analyses ADD CONSTRAINT analyses_type_check CHECK (
  type IN (
    'prd', 
    'divulgacao', 
    'captacao', 
    'seguranca', 
    'ui_theme', 
    'ferramentas',  -- kept for backward compatibility with legacy data
    'features', 
    'documentacao', 
    'prompts', 
    'quality',
    'performance'   -- new type added
  )
);