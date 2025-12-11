-- Create implementation_plans table
CREATE TABLE public.implementation_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  focus_type TEXT NOT NULL DEFAULT 'complete', -- 'bugs', 'features', 'security', 'complete'
  analysis_types TEXT[] NOT NULL DEFAULT '{}', -- which analyses were used
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create implementation_items table
CREATE TABLE public.implementation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.implementation_plans(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'improvement', -- 'critical', 'implementation', 'improvement'
  title TEXT NOT NULL,
  description TEXT,
  source_analysis TEXT, -- which analysis type this came from
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.implementation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implementation_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for implementation_plans
CREATE POLICY "Users can view own plans"
ON public.implementation_plans FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own plans"
ON public.implementation_plans FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans"
ON public.implementation_plans FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plans"
ON public.implementation_plans FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all plans"
ON public.implementation_plans FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- RLS policies for implementation_items
CREATE POLICY "Users can view own items"
ON public.implementation_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.implementation_plans p
  WHERE p.id = implementation_items.plan_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can create own items"
ON public.implementation_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.implementation_plans p
  WHERE p.id = implementation_items.plan_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can update own items"
ON public.implementation_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.implementation_plans p
  WHERE p.id = implementation_items.plan_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can delete own items"
ON public.implementation_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.implementation_plans p
  WHERE p.id = implementation_items.plan_id AND p.user_id = auth.uid()
));

CREATE POLICY "Admins can view all items"
ON public.implementation_items FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_implementation_plans_user_id ON public.implementation_plans(user_id);
CREATE INDEX idx_implementation_plans_project_id ON public.implementation_plans(project_id);
CREATE INDEX idx_implementation_items_plan_id ON public.implementation_items(plan_id);
CREATE INDEX idx_implementation_items_category ON public.implementation_items(category);