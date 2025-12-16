-- Add column to mark legacy/corrupted cost data
ALTER TABLE public.analysis_usage 
ADD COLUMN IF NOT EXISTS is_legacy_cost boolean DEFAULT false;

-- Mark corrupted historical data where cost/tokens * 1M > 0.5 (unrealistically high)
-- This indicates the bug where cost was calculated as tokens/1000 instead of actual cost
UPDATE public.analysis_usage
SET is_legacy_cost = true
WHERE tokens_estimated > 0 
  AND cost_estimated > 0
  AND (cost_estimated / tokens_estimated * 1000000) > 0.5;

-- Add comment explaining the column
COMMENT ON COLUMN public.analysis_usage.is_legacy_cost IS 'Marks records with corrupted cost data from bug where cost = tokens/1000 instead of real calculation';