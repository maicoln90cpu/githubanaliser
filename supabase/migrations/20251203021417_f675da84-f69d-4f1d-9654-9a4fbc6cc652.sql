-- Criar tabela de configurações do sistema
CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler/modificar configurações
CREATE POLICY "Admins can view settings"
  ON public.system_settings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage settings"
  ON public.system_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role pode ler (para edge functions)
CREATE POLICY "Service role can read settings"
  ON public.system_settings
  FOR SELECT
  USING (true);

-- Inserir configuração padrão
INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('analysis_mode', 'detailed', 'Modo de análise: detailed (completo) ou economic (econômico)'),
  ('economic_max_context', '15000', 'Tamanho máximo do contexto em modo econômico (caracteres)'),
  ('detailed_max_context', '40000', 'Tamanho máximo do contexto em modo detalhado (caracteres)');