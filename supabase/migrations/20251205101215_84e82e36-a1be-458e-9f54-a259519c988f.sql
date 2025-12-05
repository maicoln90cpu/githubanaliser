-- Atualizar a função get_user_plan para retornar o campo config
DROP FUNCTION IF EXISTS public.get_user_plan(uuid);

CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id uuid)
 RETURNS TABLE(
   plan_id uuid, 
   plan_name text, 
   plan_slug text, 
   monthly_analyses integer, 
   daily_analyses integer,
   plan_config jsonb
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as plan_id,
    p.name as plan_name,
    p.slug as plan_slug,
    p.monthly_analyses,
    p.daily_analyses,
    COALESCE(p.config, '{}'::jsonb) as plan_config
  FROM user_subscriptions us
  JOIN plans p ON p.id = us.plan_id
  WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    AND (us.expires_at IS NULL OR us.expires_at > now())
  ORDER BY us.created_at DESC
  LIMIT 1;
  
  -- If no subscription, return free plan
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      p.id as plan_id,
      p.name as plan_name,
      p.slug as plan_slug,
      p.monthly_analyses,
      p.daily_analyses,
      COALESCE(p.config, '{}'::jsonb) as plan_config
    FROM plans p
    WHERE p.slug = 'free'
    LIMIT 1;
  END IF;
END;
$function$;