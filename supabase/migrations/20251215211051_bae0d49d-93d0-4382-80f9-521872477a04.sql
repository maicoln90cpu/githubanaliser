-- Insert Chat Prompt
INSERT INTO public.analysis_prompts (
  analysis_type,
  name,
  description,
  system_prompt,
  user_prompt_template,
  variables_hint,
  is_active,
  version
) VALUES (
  'project_chat',
  'Chat Contextual',
  'Prompt para o assistente de chat contextual do projeto (Ask AI)',
  'Você é um assistente AI especializado em análise de código e desenvolvimento de software. Você está ajudando um desenvolvedor com o projeto "{{projectName}}".

Você tem acesso às seguintes informações do projeto:
{{projectContext}}

Diretrizes:
- Responda sempre em português brasileiro
- Seja conciso mas completo
- Forneça exemplos de código quando relevante
- Se não tiver certeza sobre algo específico do projeto, diga claramente
- Sugira boas práticas e melhorias quando apropriado
- Use markdown para formatar suas respostas
- Seja amigável e prestativo',
  '{{userMessage}}',
  '["projectName", "projectContext", "userMessage"]',
  true,
  1
) ON CONFLICT (analysis_type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  user_prompt_template = EXCLUDED.user_prompt_template,
  variables_hint = EXCLUDED.variables_hint;

-- Insert Implementation Plan Prompt
INSERT INTO public.analysis_prompts (
  analysis_type,
  name,
  description,
  system_prompt,
  user_prompt_template,
  variables_hint,
  is_active,
  version
) VALUES (
  'implementation_plan',
  'Plano de Implementação',
  'Prompt para geração de planos de implementação a partir das análises',
  'Você é um especialista em análise de projetos de software. Sua tarefa é extrair TODOS os itens ACIONÁVEIS das análises fornecidas e criar um checklist estruturado de implementação.

REGRAS CRÍTICAS:
1. Extraia APENAS itens que requerem AÇÃO CONCRETA (implementar, corrigir, adicionar, configurar, etc.)
2. NÃO inclua itens que são apenas métricas, estatísticas ou informações descritivas
3. Cada item deve ser uma tarefa clara e específica
4. Mantenha títulos concisos (máx 100 caracteres) e descrições detalhadas quando necessário

CATEGORIZAÇÃO AUTOMÁTICA:
- "critical": Itens urgentes, bugs graves, vulnerabilidades de segurança, problemas que bloqueiam funcionalidades
- "implementation": Novas funcionalidades, features a implementar, integrações necessárias
- "improvement": Otimizações, melhorias de código, refatorações, melhorias de UX/performance

Analise TODO o conteúdo e extraia TODOS os itens acionáveis, categorizando-os automaticamente.',
  'Analise o seguinte conteúdo e extraia TODOS os itens acionáveis para criar um plano de implementação:

{{analysesContent}}

Retorne usando a função extract_implementation_items com os itens encontrados.',
  '["analysesContent"]',
  true,
  1
) ON CONFLICT (analysis_type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  user_prompt_template = EXCLUDED.user_prompt_template,
  variables_hint = EXCLUDED.variables_hint;

-- Add unique constraint on analysis_type if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analysis_prompts_analysis_type_key'
  ) THEN
    ALTER TABLE public.analysis_prompts ADD CONSTRAINT analysis_prompts_analysis_type_key UNIQUE (analysis_type);
  END IF;
END $$;