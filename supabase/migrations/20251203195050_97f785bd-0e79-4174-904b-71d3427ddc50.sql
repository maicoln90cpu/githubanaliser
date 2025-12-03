-- Tabela para armazenar estado de checklist por usuário
CREATE TABLE public.user_checklist_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    item_hash text NOT NULL,
    is_completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, analysis_id, item_hash)
);

-- Enable RLS
ALTER TABLE public.user_checklist_items ENABLE ROW LEVEL SECURITY;

-- Users can only view their own checklist items
CREATE POLICY "Users can view own checklist items"
ON public.user_checklist_items
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own checklist items
CREATE POLICY "Users can create own checklist items"
ON public.user_checklist_items
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own checklist items
CREATE POLICY "Users can update own checklist items"
ON public.user_checklist_items
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own checklist items
CREATE POLICY "Users can delete own checklist items"
ON public.user_checklist_items
FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_user_checklist_analysis ON public.user_checklist_items(user_id, analysis_id);