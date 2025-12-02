-- Adicionar coluna user_id na tabela projects
ALTER TABLE public.projects ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Atualizar políticas RLS para projetos (usuários veem apenas seus projetos)
DROP POLICY IF EXISTS "Permitir leitura pública de projetos" ON public.projects;
DROP POLICY IF EXISTS "Permitir inserção pública de projetos" ON public.projects;
DROP POLICY IF EXISTS "Permitir atualização pública de projetos" ON public.projects;

-- Política para usuários autenticados verem seus próprios projetos
CREATE POLICY "Users can view own projects" 
ON public.projects 
FOR SELECT 
USING (auth.uid() = user_id);

-- Política para usuários autenticados criarem projetos
CREATE POLICY "Users can create own projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Política para usuários autenticados atualizarem seus projetos
CREATE POLICY "Users can update own projects" 
ON public.projects 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Política para usuários autenticados deletarem seus projetos
CREATE POLICY "Users can delete own projects" 
ON public.projects 
FOR DELETE 
USING (auth.uid() = user_id);

-- Atualizar políticas RLS para análises
DROP POLICY IF EXISTS "Permitir leitura pública de análises" ON public.analyses;
DROP POLICY IF EXISTS "Permitir inserção pública de análises" ON public.analyses;

-- Análises são visíveis apenas se o usuário possui o projeto
CREATE POLICY "Users can view own analyses" 
ON public.analyses 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = analyses.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- Análises podem ser criadas apenas para projetos do usuário
CREATE POLICY "Users can create analyses for own projects" 
ON public.analyses 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = analyses.project_id 
    AND projects.user_id = auth.uid()
  )
);