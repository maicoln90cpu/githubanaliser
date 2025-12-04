-- Remover constraint antiga que tem 'melhorias' em vez de 'documentacao'
ALTER TABLE analyses DROP CONSTRAINT IF EXISTS analyses_type_check;

-- Criar nova constraint com 'documentacao' incluído (substituindo 'melhorias')
ALTER TABLE analyses ADD CONSTRAINT analyses_type_check 
CHECK (type = ANY (ARRAY[
  'prd'::text, 
  'divulgacao'::text, 
  'captacao'::text, 
  'seguranca'::text, 
  'ui_theme'::text, 
  'ferramentas'::text, 
  'features'::text, 
  'documentacao'::text
]));