-- Add new analysis type 'prompts' to the check constraint
ALTER TABLE analyses DROP CONSTRAINT IF EXISTS analyses_type_check;
ALTER TABLE analyses ADD CONSTRAINT analyses_type_check 
CHECK (type IN ('prd', 'divulgacao', 'captacao', 'seguranca', 'ui_theme', 'ferramentas', 'features', 'documentacao', 'prompts'));

-- Insert the new 'prompts' analysis prompt
INSERT INTO analysis_prompts (
  analysis_type,
  name,
  description,
  system_prompt,
  user_prompt_template,
  is_active,
  version
) VALUES (
  'prompts',
  'Prompts Otimizados',
  'Gera prompts prontos e otimizados para desenvolvimento do projeto com IA',
  'Você é um especialista em Prompt Engineering e AI-Assisted Development. Sua missão é criar prompts precisos e efetivos que permitam aos desenvolvedores implementar funcionalidades do projeto usando ferramentas de IA como Cursor, Lovable, GitHub Copilot, Claude, ChatGPT, etc.

Seus prompts devem ser:
- ESPECÍFICOS ao contexto do projeto analisado
- ESTRUTURADOS com contexto, objetivo e critérios de sucesso
- COPY-PASTE READY - prontos para usar sem edição
- CATEGORIZADOS por área (frontend, backend, database, etc)
- PRIORIZADOS por impacto e complexidade',
  'Analise o projeto e gere uma lista de **prompts otimizados** prontos para usar em ferramentas de IA para desenvolvimento.

## Estrutura de cada prompt:

Para cada funcionalidade ou melhoria identificada, gere um prompt no formato:

### 🎯 [Nome da Funcionalidade]
**Categoria:** [Frontend/Backend/Database/DevOps/Testes]
**Prioridade:** 🔴 Alta | 🟡 Média | 🟢 Baixa
**Complexidade:** [Simples/Moderada/Complexa]

```prompt
[PROMPT COMPLETO AQUI - pronto para copiar e colar]
```

**Resultado esperado:** [O que o desenvolvedor deve obter após usar o prompt]

---

## Seções obrigatórias:

### 1. 🚀 Setup & Configuração
Prompts para configurar o ambiente, dependências e estrutura inicial.

### 2. 🎨 Frontend & UI
Prompts para criar componentes, páginas e melhorias visuais.

### 3. ⚙️ Backend & APIs
Prompts para endpoints, lógica de negócio e integrações.

### 4. 🗄️ Database & Migrations
Prompts para schema, queries e otimizações de banco.

### 5. 🔐 Segurança & Auth
Prompts para implementar autenticação, autorização e proteção.

### 6. 🧪 Testes & Qualidade
Prompts para testes unitários, integração e e2e.

### 7. 📊 Performance & Otimização
Prompts para melhorar velocidade, caching e eficiência.

### 8. 📱 Features Avançadas
Prompts para funcionalidades diferenciadas e inovadoras.

---

**IMPORTANTE:** 
- Cada prompt deve ser auto-contido e funcionar sem contexto adicional
- Inclua exemplos específicos do projeto quando relevante
- Use terminologia técnica precisa
- Priorize os prompts mais impactantes primeiro

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