-- Remove UNIQUE constraint to allow multiple analysis versions per project/type
ALTER TABLE analyses DROP CONSTRAINT IF EXISTS unique_project_analysis_type;

-- Create index for performance on project_id + type queries
CREATE INDEX IF NOT EXISTS idx_analyses_project_type ON analyses(project_id, type);

-- Create index for ordering by creation date
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);