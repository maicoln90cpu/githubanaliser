-- Criar tabela de projetos
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  github_url TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de análises
CREATE TABLE public.analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('prd', 'captacao', 'melhorias')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX idx_analyses_project_id ON public.analyses(project_id);
CREATE INDEX idx_analyses_type ON public.analyses(type);
CREATE INDEX idx_projects_created_at ON public.projects(created_at DESC);

-- Habilitar Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - permitir leitura pública (sem login)
CREATE POLICY "Permitir leitura pública de projetos" 
ON public.projects 
FOR SELECT 
USING (true);

CREATE POLICY "Permitir leitura pública de análises" 
ON public.analyses 
FOR SELECT 
USING (true);

CREATE POLICY "Permitir inserção pública de projetos" 
ON public.projects 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Permitir inserção pública de análises" 
ON public.analyses 
FOR INSERT 
WITH CHECK (true);