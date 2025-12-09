-- Add new analysis type 'quality' and update constraint
ALTER TABLE analyses DROP CONSTRAINT IF EXISTS analyses_type_check;
ALTER TABLE analyses ADD CONSTRAINT analyses_type_check 
CHECK (type IN ('prd', 'divulgacao', 'captacao', 'seguranca', 'ui_theme', 'ferramentas', 'features', 'documentacao', 'prompts', 'quality'));

-- Insert the new 'quality' analysis prompt for Code Quality Metrics
INSERT INTO analysis_prompts (
  analysis_type,
  name,
  description,
  system_prompt,
  user_prompt_template,
  is_active,
  version
) VALUES (
  'quality',
  'Qualidade de Código',
  'Análise detalhada de métricas de qualidade do código com estimativas de complexidade, manutenibilidade e cobertura',
  'Você é um arquiteto de software sênior especializado em análise de qualidade de código, métricas de software e boas práticas de engenharia. Sua missão é avaliar projetos de software e fornecer métricas estimadas de qualidade baseadas na análise do código fonte, estrutura e padrões identificados.

Você deve fornecer:
- Estimativas numéricas realistas baseadas em padrões observados
- Identificação de code smells e anti-patterns
- Avaliação de arquitetura e modularidade
- Análise de debt técnico
- Recomendações priorizadas de melhoria',
  'Analise o projeto e gere um relatório completo de **Qualidade de Código** com métricas estimadas.

## Estrutura Obrigatória:

### 📊 Dashboard de Métricas

Forneça uma tabela com as seguintes métricas estimadas (0-100):

| Métrica | Score | Status |
|---------|-------|--------|
| Complexidade Ciclomática | XX/100 | 🟢/🟡/🔴 |
| Manutenibilidade | XX/100 | 🟢/🟡/🔴 |
| Cobertura Estimada de Testes | XX% | 🟢/🟡/🔴 |
| Documentação do Código | XX/100 | 🟢/🟡/🔴 |
| Acoplamento | XX/100 | 🟢/🟡/🔴 |
| Coesão | XX/100 | 🟢/🟡/🔴 |
| Duplicação de Código | XX% | 🟢/🟡/🔴 |
| Aderência a Padrões | XX/100 | 🟢/🟡/🔴 |

**Score Geral de Qualidade: XX/100**

---

### 🔍 Análise Detalhada

#### 1. Complexidade do Código
- Arquivos mais complexos identificados
- Funções/componentes que precisam refatoração
- Estimativa de tempo para simplificação

#### 2. Arquitetura e Estrutura
- Avaliação da organização de pastas
- Padrões arquiteturais identificados
- Separação de responsabilidades

#### 3. Code Smells Detectados
Lista os principais problemas identificados:
- [ ] Nome do problema - Descrição e arquivo afetado

#### 4. Debt Técnico
- Estimativa de horas para resolver
- Priorização por impacto
- Quick wins identificados

#### 5. Padrões e Boas Práticas
- Padrões seguidos ✅
- Padrões ausentes ❌
- Recomendações

---

### 📈 Tendências e Riscos

- Riscos de escalabilidade
- Pontos de fragilidade
- Dependências problemáticas

---

### ✅ Plano de Ação Priorizado

| Prioridade | Ação | Impacto | Esforço |
|------------|------|---------|---------|
| 🔴 Alta | Descrição | Alto/Médio/Baixo | Xh |
| 🟡 Média | Descrição | Alto/Médio/Baixo | Xh |
| 🟢 Baixa | Descrição | Alto/Médio/Baixo | Xh |

---

Contexto do Projeto:
{{readme}}
{{structure}}
{{dependencies}}
{{sourceCode}}',
  true,
  1
) ON CONFLICT (analysis_type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  user_prompt_template = EXCLUDED.user_prompt_template,
  is_active = EXCLUDED.is_active,
  updated_at = now();