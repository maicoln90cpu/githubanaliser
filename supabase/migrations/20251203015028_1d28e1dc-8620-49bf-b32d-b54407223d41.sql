-- Add github_data column to cache extracted data
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS github_data JSONB;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_github_data ON public.projects USING GIN (github_data);