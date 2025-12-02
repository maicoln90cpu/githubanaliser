-- Add analysis status tracking columns to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT 'pending';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add update policy for projects (needed for edge function to update status)
CREATE POLICY "Permitir atualização pública de projetos" 
ON public.projects 
FOR UPDATE 
USING (true)
WITH CHECK (true);