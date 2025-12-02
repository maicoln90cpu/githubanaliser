-- Remove the unique constraint on github_url since multiple users can analyze the same repo
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_github_url_key;

-- Add a composite unique constraint on (github_url, user_id) instead
ALTER TABLE public.projects ADD CONSTRAINT projects_github_url_user_id_key UNIQUE (github_url, user_id);