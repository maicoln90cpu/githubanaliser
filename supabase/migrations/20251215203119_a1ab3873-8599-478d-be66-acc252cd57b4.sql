-- Insert performance prompt into analysis_prompts
INSERT INTO analysis_prompts (analysis_type, name, description, system_prompt, user_prompt_template, is_active)
VALUES (
  'performance',
  'Performance & Observabilidade',
  'Análise de performance, otimização e observabilidade da aplicação',
  'Você é um especialista em performance de software, otimização de aplicações web e observabilidade. Você domina Core Web Vitals, bundle optimization, database queries, caching strategies, logging, métricas e alertas. Sua análise deve ser prática, com quick wins e melhorias de longo prazo.',
  'Analise o projeto e gere um relatório completo de Performance & Observabilidade em português brasileiro. Inclua:

## 🎯 Resumo Executivo
- Score estimado de performance (0-100)
- Quick wins identificados
- Riscos críticos

## ⚡ Core Web Vitals
- LCP (Largest Contentful Paint) - estimativas e melhorias
- FID/INP (Interaction to Next Paint) - análise de interatividade
- CLS (Cumulative Layout Shift) - estabilidade visual

## 📦 Otimização de Bundle
- Análise de dependências pesadas
- Code splitting opportunities
- Tree shaking recommendations
- Lazy loading suggestions

## 🗄️ Performance de Banco de Dados
- Análise de queries (N+1, índices faltantes)
- Estratégias de caching
- Connection pooling

## 🔍 Observabilidade
- Logging estruturado
- Métricas essenciais a monitorar
- Alertas recomendados
- Tracing distribuído (se aplicável)

## 📊 Checklist de Implementação
| Item | Prioridade | Impacto | Esforço |
|------|------------|---------|---------|
| ... | Alta/Média/Baixa | Alto/Médio/Baixo | Pequeno/Médio/Grande |

Baseie sua análise no código fonte, dependências e estrutura do projeto.',
  true
);

-- Update plans.config: remove ferramentas, add performance, fix quality naming
UPDATE plans
SET config = jsonb_set(
  jsonb_set(
    config,
    '{allowed_analysis_types}',
    (
      SELECT jsonb_agg(
        CASE 
          WHEN value::text = '"ferramentas"' THEN '"quality"'
          WHEN value::text = '"qualidade"' THEN '"quality"'
          ELSE value
        END
      )
      FROM jsonb_array_elements(
        COALESCE(config->'allowed_analysis_types', '[]'::jsonb)
      )
      WHERE value::text NOT IN ('"ferramentas"', '"qualidade"')
    ) || '["performance"]'::jsonb
  ),
  '{allowed_analysis_types}',
  (
    SELECT COALESCE(
      jsonb_agg(DISTINCT elem),
      '[]'::jsonb
    )
    FROM (
      SELECT 
        CASE 
          WHEN value::text = '"ferramentas"' THEN 'quality'
          WHEN value::text = '"qualidade"' THEN 'quality'
          ELSE value #>> '{}'
        END as elem
      FROM jsonb_array_elements(
        COALESCE(config->'allowed_analysis_types', '[]'::jsonb)
      )
      UNION
      SELECT 'performance'
    ) sub
    WHERE elem IS NOT NULL
  )
)
WHERE config IS NOT NULL AND config ? 'allowed_analysis_types';