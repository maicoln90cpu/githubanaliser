-- Add github_access_token to profiles table for private repo access
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS github_access_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS github_username TEXT;

-- Create consolidated dashboard data RPC function
CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  v_projects jsonb;
  v_recent_activities jsonb;
  v_checklist_stats jsonb;
  v_total_tokens bigint;
BEGIN
  -- Get projects
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'github_url', p.github_url,
      'created_at', p.created_at,
      'analysis_status', p.analysis_status
    ) ORDER BY p.created_at DESC
  ), '[]'::jsonb)
  INTO v_projects
  FROM projects p
  WHERE p.user_id = p_user_id;

  -- Get recent activities (last 5 completed projects + checklist items)
  WITH project_activities AS (
    SELECT 
      'project-' || p.id as id,
      'project' as type,
      'Análise concluída: ' || p.name as description,
      p.created_at as timestamp,
      p.name as project_name
    FROM projects p
    WHERE p.user_id = p_user_id AND p.analysis_status = 'completed'
    ORDER BY p.created_at DESC
    LIMIT 5
  ),
  checklist_activities AS (
    SELECT 
      'checklist-' || c.id as id,
      'checklist' as type,
      'Item de checklist concluído' as description,
      c.completed_at as timestamp,
      NULL as project_name
    FROM user_checklist_items c
    WHERE c.user_id = p_user_id AND c.is_completed = true AND c.completed_at IS NOT NULL
    ORDER BY c.completed_at DESC
    LIMIT 5
  ),
  combined AS (
    SELECT * FROM project_activities
    UNION ALL
    SELECT * FROM checklist_activities
    ORDER BY timestamp DESC
    LIMIT 5
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'type', c.type,
      'description', c.description,
      'timestamp', c.timestamp,
      'projectName', c.project_name
    )
  ), '[]'::jsonb)
  INTO v_recent_activities
  FROM combined c;

  -- Get checklist stats
  SELECT jsonb_build_object(
    'total', COALESCE(COUNT(*), 0),
    'completed', COALESCE(COUNT(*) FILTER (WHERE is_completed = true), 0)
  )
  INTO v_checklist_stats
  FROM user_checklist_items
  WHERE user_id = p_user_id;

  -- Get total tokens
  SELECT COALESCE(SUM(tokens_estimated), 0)
  INTO v_total_tokens
  FROM analysis_usage
  WHERE user_id = p_user_id;

  -- Build result
  result := jsonb_build_object(
    'projects', v_projects,
    'recentActivities', v_recent_activities,
    'checklistStats', v_checklist_stats,
    'totalTokens', v_total_tokens
  );

  RETURN result;
END;
$$;