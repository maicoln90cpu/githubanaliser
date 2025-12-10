-- Add is_pinned column for favorite/pinned projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

-- Create index for faster pinned queries
CREATE INDEX IF NOT EXISTS idx_projects_pinned ON public.projects (user_id, is_pinned DESC, created_at DESC);