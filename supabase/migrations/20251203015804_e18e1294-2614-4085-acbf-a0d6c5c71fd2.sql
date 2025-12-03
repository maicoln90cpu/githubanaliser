-- Limpar análises duplicadas mantendo apenas a mais recente de cada tipo por projeto
DELETE FROM analyses a
WHERE a.id NOT IN (
  SELECT DISTINCT ON (project_id, type) id
  FROM analyses
  ORDER BY project_id, type, created_at DESC
);

-- Adicionar constraint única para evitar duplicatas futuras
ALTER TABLE analyses ADD CONSTRAINT unique_project_analysis_type UNIQUE (project_id, type);