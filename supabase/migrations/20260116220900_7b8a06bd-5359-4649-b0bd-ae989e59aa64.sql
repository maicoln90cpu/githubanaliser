-- Índices para otimização de queries frequentes
-- Fase 2 da Auditoria Completa

-- Index 1: Tokens mensais por usuário (query frequente em useRealModelCosts e dashboard)
CREATE INDEX IF NOT EXISTS idx_analysis_usage_user_created 
ON analysis_usage(user_id, created_at DESC);

-- Index 2: Polling de queue (executado a cada 2 segundos na página Analyzing)
CREATE INDEX IF NOT EXISTS idx_analysis_queue_project_status 
ON analysis_queue(project_id, status);

-- Index 3: Busca de análises por projeto e tipo
CREATE INDEX IF NOT EXISTS idx_analyses_project_type 
ON analyses(project_id, type);

-- Index 4: Dashboard ordenação de projetos por usuário
CREATE INDEX IF NOT EXISTS idx_projects_user_created 
ON projects(user_id, created_at DESC);