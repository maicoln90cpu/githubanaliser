-- Criar tabela para gerenciamento de prompts de IA
CREATE TABLE public.analysis_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_type TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  variables_hint JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.analysis_prompts ENABLE ROW LEVEL SECURITY;

-- Only admins can manage prompts
CREATE POLICY "Admins can manage prompts"
ON public.analysis_prompts
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Service role can read prompts (for edge functions)
CREATE POLICY "Service role can read prompts"
ON public.analysis_prompts
FOR SELECT
USING (true);

-- Insert default prompts for all 8 analysis types
INSERT INTO public.analysis_prompts (analysis_type, name, description, system_prompt, user_prompt_template, variables_hint) VALUES
('prd', 'Análise PRD', 'Product Requirements Document completo', 
'Você é um especialista em documentação de produtos e análise técnica. Gere documentos profissionais, detalhados e acionáveis em português brasileiro.',
'Analise o repositório GitHub a seguir e gere um PRD (Product Requirements Document) completo.

**Contexto do Projeto:**
- Nome: {{projectName}}
- URL: {{githubUrl}}
- README: {{readme}}
- Estrutura: {{structure}}
- Dependências: {{dependencies}}
- Código fonte relevante: {{sourceCode}}

Gere um PRD profissional incluindo:
1. Visão geral do produto
2. Objetivos e métricas de sucesso
3. Público-alvo e personas
4. Requisitos funcionais detalhados
5. Requisitos não-funcionais
6. Arquitetura técnica
7. Roadmap sugerido
8. Riscos e mitigações

Use tabelas, checklists e formatação Markdown profissional.',
'["projectName", "githubUrl", "readme", "structure", "dependencies", "sourceCode"]'),

('divulgacao', 'Plano de Divulgação', 'Estratégia de marketing digital',
'Você é um especialista em marketing digital e growth hacking. Crie estratégias práticas e acionáveis em português brasileiro.',
'Analise o projeto e crie um plano de divulgação completo.

**Contexto do Projeto:**
- Nome: {{projectName}}
- URL: {{githubUrl}}
- README: {{readme}}
- Estrutura: {{structure}}

Gere um plano de divulgação incluindo:
1. Análise de mercado e concorrência
2. Proposta de valor única
3. Canais de aquisição prioritários
4. Estratégia de conteúdo
5. Calendário editorial (30/60/90 dias)
6. Métricas e KPIs
7. Orçamento sugerido
8. Checklist de lançamento

Use tabelas e checklists acionáveis.',
'["projectName", "githubUrl", "readme", "structure"]'),

('captacao', 'Plano de Captação', 'Estratégia para investidores',
'Você é um especialista em captação de investimentos e pitch decks. Crie materiais profissionais para investidores em português brasileiro.',
'Analise o projeto e crie um plano de captação de investimentos.

**Contexto do Projeto:**
- Nome: {{projectName}}
- URL: {{githubUrl}}
- README: {{readme}}
- Estrutura: {{structure}}

Gere um plano de captação incluindo:
1. Executive Summary
2. Problema e solução
3. Tamanho do mercado (TAM/SAM/SOM)
4. Modelo de negócio
5. Tração e métricas
6. Competição e diferencial
7. Equipe necessária
8. Projeções financeiras
9. Ask e uso dos recursos
10. Roadmap de milestones

Use tabelas e visualizações profissionais.',
'["projectName", "githubUrl", "readme", "structure"]'),

('seguranca', 'Análise de Segurança', 'Vulnerabilidades e boas práticas',
'Você é um especialista em segurança de aplicações (AppSec) e penetration testing. Identifique vulnerabilidades e sugira correções em português brasileiro.',
'Analise o projeto e identifique vulnerabilidades de segurança.

**Contexto do Projeto:**
- Nome: {{projectName}}
- URL: {{githubUrl}}
- README: {{readme}}
- Estrutura: {{structure}}
- Dependências: {{dependencies}}
- Código fonte: {{sourceCode}}

Gere uma análise de segurança incluindo:
1. Resumo executivo de riscos
2. Vulnerabilidades críticas encontradas
3. Vulnerabilidades médias
4. Vulnerabilidades baixas
5. Dependências desatualizadas/vulneráveis
6. Boas práticas não implementadas
7. Checklist de correções prioritárias
8. Recomendações de compliance (LGPD, etc.)

Priorize por severidade e facilidade de correção.',
'["projectName", "githubUrl", "readme", "structure", "dependencies", "sourceCode"]'),

('ui_theme', 'Melhorias de UI/Theme', 'Design e experiência do usuário',
'Você é um especialista em UI/UX design e design systems. Sugira melhorias visuais e de experiência em português brasileiro.',
'Analise o projeto e sugira melhorias de UI/UX.

**Contexto do Projeto:**
- Nome: {{projectName}}
- URL: {{githubUrl}}
- README: {{readme}}
- Estrutura: {{structure}}
- Código fonte (componentes): {{sourceCode}}

Gere sugestões de UI/UX incluindo:
1. Análise da arquitetura visual atual
2. Paleta de cores sugerida
3. Tipografia recomendada
4. Componentes a melhorar
5. Padrões de design system
6. Acessibilidade (WCAG)
7. Responsividade
8. Micro-interações e animações
9. Checklist de implementação

Inclua exemplos de código quando relevante.',
'["projectName", "githubUrl", "readme", "structure", "sourceCode"]'),

('ferramentas', 'Otimização de Ferramentas', 'Performance e código',
'Você é um especialista em DevOps, performance e arquitetura de software. Sugira otimizações técnicas em português brasileiro.',
'Analise o projeto e sugira otimizações de ferramentas e código.

**Contexto do Projeto:**
- Nome: {{projectName}}
- URL: {{githubUrl}}
- README: {{readme}}
- Estrutura: {{structure}}
- Dependências: {{dependencies}}
- Código fonte: {{sourceCode}}

Gere sugestões de otimização incluindo:
1. Análise de dependências (desatualizadas, redundantes)
2. Performance de build e bundle size
3. Otimizações de runtime
4. Refatorações sugeridas
5. Testes automatizados
6. CI/CD melhorias
7. Monitoramento e logging
8. Checklist de implementação

Priorize por impacto e facilidade.',
'["projectName", "githubUrl", "readme", "structure", "dependencies", "sourceCode"]'),

('features', 'Novas Features', 'Sugestões de funcionalidades',
'Você é um especialista em product management e análise de mercado. Sugira features inovadoras e práticas em português brasileiro.',
'Analise o projeto e sugira novas funcionalidades.

**Contexto do Projeto:**
- Nome: {{projectName}}
- URL: {{githubUrl}}
- README: {{readme}}
- Estrutura: {{structure}}
- Código fonte: {{sourceCode}}

Gere sugestões de features incluindo:
1. Análise das funcionalidades atuais
2. Gaps identificados
3. Features de alto impacto
4. Features de quick wins
5. Integrações sugeridas
6. Tendências de mercado aplicáveis
7. Priorização (MoSCoW ou RICE)
8. Roadmap sugerido
9. Checklist de implementação

Base as sugestões em análise de mercado real.',
'["projectName", "githubUrl", "readme", "structure", "sourceCode"]'),

('documentacao', 'Documentação Técnica', 'README e guias',
'Você é um especialista em documentação técnica e developer experience. Crie documentação clara e completa em português brasileiro.',
'Analise o projeto e gere documentação técnica completa.

**Contexto do Projeto:**
- Nome: {{projectName}}
- URL: {{githubUrl}}
- README atual: {{readme}}
- Estrutura: {{structure}}
- Dependências: {{dependencies}}
- Código fonte: {{sourceCode}}

Gere documentação incluindo:
1. README.md profissional completo
2. Guia de instalação detalhado
3. Guia de configuração
4. Referência de API (se aplicável)
5. Exemplos de uso
6. Guia de contribuição
7. Changelog template
8. FAQ técnico
9. Troubleshooting comum

Use formatação Markdown profissional com badges.',
'["projectName", "githubUrl", "readme", "structure", "dependencies", "sourceCode"]');

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_analysis_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_analysis_prompts_timestamp
BEFORE UPDATE ON public.analysis_prompts
FOR EACH ROW
EXECUTE FUNCTION update_analysis_prompts_updated_at();