-- Create analysis_queue table for managing sequential analysis processing
CREATE TABLE public.analysis_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, error
  depth_level TEXT NOT NULL DEFAULT 'balanced',
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.analysis_queue ENABLE ROW LEVEL SECURITY;

-- Index for efficient queue processing
CREATE INDEX idx_analysis_queue_status ON analysis_queue(status, created_at);
CREATE INDEX idx_analysis_queue_project ON analysis_queue(project_id);

-- Policies
CREATE POLICY "Users can view own queue items"
ON analysis_queue FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queue items"
ON analysis_queue FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own queue items"
ON analysis_queue FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own queue items"
ON analysis_queue FOR DELETE
USING (auth.uid() = user_id);

-- Service role policy for edge functions
CREATE POLICY "Service role has full access"
ON analysis_queue FOR ALL
USING (true)
WITH CHECK (true);