# 🔍 GitAnalyzer - Sistema de Análise de Repositórios GitHub

Sistema SaaS completo para análise de repositórios GitHub usando IA, gerando 10 tipos diferentes de análises técnicas e de negócio. Construído com React + Vite + Supabase + Lovable AI.

**URL do Projeto:** https://lovable.dev/projects/7d5991ba-592a-4aba-8411-c6580eee828b

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Stack Tecnológica](#stack-tecnológica)
4. [Estrutura de Pastas](#estrutura-de-pastas)
5. [Banco de Dados (Supabase)](#banco-de-dados-supabase)
6. [Edge Functions](#edge-functions)
7. [Fluxo de Análise](#fluxo-de-análise)
8. [Sistema de Planos e Billing](#sistema-de-planos-e-billing)
9. [Painel Administrativo](#painel-administrativo)
10. [Sistema de Custos](#sistema-de-custos)
11. [Hooks Principais](#hooks-principais)
12. [Componentes Chave](#componentes-chave)
13. [Configurações Importantes](#configurações-importantes)
14. [Troubleshooting](#troubleshooting)
15. [Decisões de Design](#decisões-de-design)
16. [Como Editar o Código](#como-editar-o-código)

---

## 🎯 Visão Geral

GitAnalyzer analisa repositórios GitHub públicos e gera análises detalhadas usando IA. O sistema suporta:

### Tipos de Análise (10 tipos ativos)
| Tipo | Slug BD | Descrição | Status |
|------|---------|-----------|--------|
| PRD | `prd` | Product Requirements Document completo | ✅ Ativo |
| Marketing & Lançamento | `divulgacao` | Estratégia de marketing e go-to-market | ✅ Ativo |
| Pitch para Investidores | `captacao` | Pitch deck e estratégia de funding | ✅ Ativo |
| Segurança | `seguranca` | Análise de vulnerabilidades e recomendações | ✅ Ativo |
| UI/Theme | `ui_theme` | Melhorias visuais e UX | ✅ Ativo |
| Novas Features | `features` | Sugestões de funcionalidades | ✅ Ativo |
| Documentação | `documentacao` | README profissional e docs técnicos | ✅ Ativo |
| Prompts Otimizados | `prompts` | Prompts para Cursor/Lovable/Copilot | ✅ Ativo |
| Qualidade & Ferramentas | `quality` | Métricas de qualidade + otimização de ferramentas | ✅ Ativo |
| Performance & Observabilidade | `performance` | Core Web Vitals, bundle size, logs, monitoring | ✅ Ativo |
| Ferramentas (Legado) | `ferramentas` | ⚠️ Incorporado em `quality` - só leitura histórica | 🔶 Legado |

### Níveis de Profundidade
| Nível | Contexto | Tokens Estimados (Mediana) | Custo Relativo |
|-------|----------|----------------------------|----------------|
| Critical | ~8KB | ~8K tokens/análise | Mais barato |
| Balanced | ~20KB | ~15K tokens/análise | Moderado |
| Complete | ~40KB | ~25K tokens/análise | Mais caro |

> ⚠️ **Importante:** Tokens são calculados usando **mediana** (não média) para proteção contra outliers.

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
├─────────────────────────────────────────────────────────────────┤
│  Home.tsx → Analyzing.tsx → ProjectHub.tsx → Analysis Pages     │
│      ↓              ↓              ↓              ↓             │
│  [Input URL]   [Polling]    [Cards Grid]   [Markdown View]      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTIONS                       │
├─────────────────────────────────────────────────────────────────┤
│  analyze-github           → Extrai dados do GitHub              │
│  process-single-analysis  → Processa 1 análise por vez          │
│  project-chat             → Chat contextual com IA              │
│  generate-implementation  → Gera plano de implementação         │
│  stripe-webhook           → Webhooks de pagamento               │
│  sync-stripe-plans        → Sincroniza planos com Stripe        │
│  create-checkout          → Cria sessão de checkout             │
│  customer-portal          → Portal do cliente Stripe            │
│  check-subscription       → Verifica assinatura ativa           │
│  list-github-repos        → Lista repos do usuário              │
│  get-invoices             → Lista faturas Stripe                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                             │
├─────────────────────────────────────────────────────────────────┤
│  projects, analyses, analysis_usage, analysis_queue,            │
│  plans, user_subscriptions, profiles, user_roles,               │
│  system_settings, analysis_prompts, implementation_plans,       │
│  implementation_items, user_checklist_items, signup_attempts    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         AI PROVIDERS                             │
├─────────────────────────────────────────────────────────────────┤
│  Lovable AI Gateway (default):                                   │
│    - google/gemini-2.5-flash (detailed mode)                    │
│    - google/gemini-2.5-flash-lite (economic mode)               │
│  OpenAI (opcional, configurável pelo admin):                    │
│    - gpt-5, gpt-5-mini, gpt-5-nano, gpt-4.1, etc.              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Stack Tecnológica

### Frontend
- **React 18** + **TypeScript**
- **Vite** - Build tool
- **TailwindCSS** + **shadcn/ui** - Design system
- **React Query** - Data fetching e cache
- **React Router** - Navegação
- **Recharts** - Gráficos
- **Lucide React** - Ícones
- **Sonner** - Toasts

### Backend
- **Supabase** - Database PostgreSQL + Auth + Edge Functions
- **Lovable AI Gateway** - Acesso a modelos Gemini/OpenAI
- **Stripe** - Pagamentos e assinaturas

### Integrações
- **GitHub API** - Extração de dados de repositórios
- **Stripe API** - Billing e subscriptions

---

## 📁 Estrutura de Pastas

```
├── src/
│   ├── components/
│   │   ├── ui/                    # shadcn components
│   │   ├── AnalysisPageLayout.tsx # Layout compartilhado para análises
│   │   ├── CheckableMarkdown.tsx  # Markdown com itens marcáveis
│   │   ├── GitHubImportModal.tsx  # Modal de import GitHub
│   │   ├── SpendingAlert.tsx      # Alertas de limite de tokens
│   │   ├── TokenUsageChart.tsx    # Gráfico de uso de tokens
│   │   ├── ViabilityScore.tsx     # Score de viabilidade (gauge)
│   │   └── ThemeToggle.tsx        # Toggle dark/light mode
│   │
│   ├── hooks/
│   │   ├── useAuth.ts             # Autenticação Supabase
│   │   ├── useUserPlan.ts         # Plano do usuário + limites
│   │   ├── useAdmin.ts            # Verificação de admin
│   │   ├── useDashboardData.ts    # Dados do dashboard (RPC)
│   │   ├── useRealModelCosts.ts   # Custos reais dos modelos
│   │   ├── useTokenHistory.ts     # Histórico de consumo
│   │   └── useChecklistState.ts   # Estado de checklists
│   │
│   ├── lib/
│   │   ├── analysisTypes.ts       # Definições centralizadas dos 10 tipos
│   │   ├── modelCosts.ts          # Custos centralizados dos modelos AI
│   │   └── utils.ts               # Funções utilitárias (cn, etc)
│   │
│   ├── pages/
│   │   ├── admin/                 # Painel administrativo
│   │   │   ├── AdminDashboard.tsx # Dashboard principal
│   │   │   ├── AdminUsers.tsx     # Gestão de usuários
│   │   │   ├── AdminProjects.tsx  # Gestão de projetos
│   │   │   ├── AdminCosts.tsx     # Análise de custos (3 sub-tabs)
│   │   │   ├── AdminPlans.tsx     # Gestão de planos e simulador
│   │   │   ├── AdminSettings.tsx  # Configurações do sistema
│   │   │   └── AdminPrompts.tsx   # Gestão de prompts
│   │   │
│   │   ├── Home.tsx               # Landing page + input análise
│   │   ├── Auth.tsx               # Login/Signup
│   │   ├── Dashboard.tsx          # Dashboard do usuário
│   │   ├── Analyzing.tsx          # Página de progresso
│   │   ├── ProjectHub.tsx         # Hub do projeto (cards)
│   │   ├── ProjectOverview.tsx    # Overview consolidado
│   │   ├── ProjectChat.tsx        # Chat contextual com IA
│   │   ├── ImplementationPlan.tsx # Plano de implementação
│   │   ├── AnalysisComparison.tsx # Comparação de versões
│   │   ├── AnalysisPerformance.tsx # Performance & Observabilidade
│   │   ├── AnalysisQuality.tsx    # Qualidade & Ferramentas (+ legado)
│   │   │
│   │   └── [Analysis Pages]       # Demais páginas de análise
│   │
│   └── integrations/supabase/
│       ├── client.ts              # Cliente Supabase (AUTO-GERADO)
│       └── types.ts               # Types do banco (AUTO-GERADO)
│
├── supabase/
│   ├── config.toml                # Configuração Supabase
│   └── functions/                 # 11 Edge Functions
│       ├── analyze-github/        # Extração + criação de queue
│       ├── process-single-analysis/ # Processa 1 análise
│       ├── project-chat/          # Chat contextual
│       ├── generate-implementation-plan/
│       ├── stripe-webhook/
│       ├── sync-stripe-plans/
│       ├── create-checkout/
│       ├── customer-portal/
│       ├── check-subscription/
│       ├── list-github-repos/
│       └── get-invoices/
│
└── public/
    └── robots.txt
```

---

## 🗄️ Banco de Dados (Supabase)

### Tabelas Principais

#### `projects`
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES auth.users
github_url TEXT NOT NULL
name TEXT NOT NULL
analysis_status TEXT  -- 'pending', 'extracting', 'generating_X', 'completed', 'error'
github_data JSONB    -- Cache dos dados do GitHub
error_message TEXT
is_pinned BOOLEAN
created_at TIMESTAMP
```

#### `analyses`
```sql
id UUID PRIMARY KEY
project_id UUID REFERENCES projects
type TEXT NOT NULL   -- 'prd', 'divulgacao', etc (10 tipos ativos + 1 legado)
content TEXT         -- Markdown gerado pela IA
created_at TIMESTAMP
-- Sem UNIQUE constraint para permitir múltiplas versões
```

#### `analysis_usage`
```sql
id UUID PRIMARY KEY
user_id UUID NOT NULL
project_id UUID REFERENCES projects
analysis_type TEXT NOT NULL
tokens_estimated INTEGER    -- Tokens reais da API
cost_estimated NUMERIC      -- Custo calculado em USD
model_used TEXT            -- 'google/gemini-2.5-flash', etc
depth_level TEXT           -- 'critical', 'balanced', 'complete'
created_at TIMESTAMP
```

#### `analysis_queue`
```sql
id UUID PRIMARY KEY
project_id UUID REFERENCES projects
user_id UUID NOT NULL
analysis_type TEXT NOT NULL
depth_level TEXT DEFAULT 'balanced'
status TEXT DEFAULT 'pending'  -- 'pending', 'processing', 'completed', 'error'
retry_count INTEGER DEFAULT 0
error_message TEXT
started_at TIMESTAMP
completed_at TIMESTAMP
created_at TIMESTAMP
```

#### `plans`
```sql
id UUID PRIMARY KEY
name TEXT NOT NULL
slug TEXT UNIQUE NOT NULL  -- 'free', 'starter', 'basic', 'pro'
description TEXT
price_monthly NUMERIC
config JSONB              -- Configuração avançada
features JSONB            -- Lista de features
stripe_product_id TEXT
stripe_price_id TEXT
is_active BOOLEAN
created_at TIMESTAMP
```

**Estrutura do `config` JSONB:**
```json
{
  "allowed_depths": ["critical", "balanced", "complete"],
  "allowed_analysis_types": ["prd", "divulgacao", ...],
  "max_tokens_monthly": 500000,
  "allow_economic_mode": true,
  "can_export_pdf": true,
  "can_use_chat": true,
  "can_use_implementation_plan": true,
  "can_compare_versions": true,
  "limitations": ["Texto descritivo..."]
}
```

#### `system_settings`
```sql
key TEXT PRIMARY KEY
value TEXT
description TEXT
updated_at TIMESTAMP
updated_by UUID
```

**Keys importantes:**
- `analysis_mode`: 'economic' | 'detailed'
- `ai_provider`: 'lovable' | 'openai'
- `openai_model`: 'gpt-5-mini', 'gpt-5', etc
- `depth_critical_context`, `depth_critical_model`
- `depth_balanced_context`, `depth_balanced_model`
- `depth_complete_context`, `depth_complete_model`
- `signup_limit_per_ip`: '3'

### RPC Functions
- `get_dashboard_data(p_user_id)` - Retorna projetos, atividades, stats
- `get_user_plan(p_user_id)` - Retorna plano atual do usuário
- `has_role(p_user_id, p_role)` - Verifica role do usuário
- `check_signup_abuse(p_ip_address)` - Anti-abuse de signup

---

## ⚡ Edge Functions

### `analyze-github`
Extrai dados do GitHub e popula queue de análise.

### `process-single-analysis`
Processa UMA análise da queue (evita timeout).

### `project-chat`
Chat contextual com IA sobre o projeto (streaming SSE).

### `stripe-webhook`
Sincroniza eventos Stripe → banco local.

### `sync-stripe-plans`
Sincroniza planos do banco → Stripe.

---

## 🔄 Fluxo de Análise

```
1. INÍCIO (Home.tsx)
   → Usuário insere URL + seleciona tipos + profundidade

2. EXTRAÇÃO (analyze-github)
   → Cria projeto + extrai GitHub + popula queue

3. POLLING + PROCESSAMENTO (Analyzing.tsx)
   → Frontend poll queue a cada 3s
   → Para cada 'pending': chama process-single-analysis
   → Análise salva em analyses + analysis_usage

4. VISUALIZAÇÃO (ProjectHub → Analysis Pages)
   → Cards mostram status
   → Clique navega para página de análise
```

---

## 💳 Sistema de Planos e Billing

| Plano | Preço | Tokens/Mês | Profundidades |
|-------|-------|------------|---------------|
| Free | R$ 0 | 50K | Critical |
| Starter | R$ 5 | 100K | Critical, Balanced |
| Basic | R$ 19.90 | 500K | Todas |
| Pro | R$ 49.90 | Ilimitado | Todas |

**Billing token-based:** Limites mensais de tokens (não contagem de análises).

---

## 🔧 Painel Administrativo

Acessível em `/admin` para usuários com role `admin`.

### AdminCosts (3 sub-tabs)
- **Custos Reais** - Executive summary, custo por modelo, evolução diária
- **Indicadores** - Rankings de modelos mais baratos, distribuições, top usuários
- **Comparativos** - ROI por plano, análise por tipo, projeções

### AdminPlans (3 sub-tabs)
- **Gestão de Planos** - Edição de preços, features toggles, sync Stripe
- **Simulador** - Simulação de cenários com diferentes depths/modes/margins
- **Viabilidade & ROI** - Análise de sustentabilidade por tokens

### Proteção contra Outliers
> ⚠️ **AdminCosts usa mediana** (não média) para calcular tokens por profundidade e por modelo, protegendo contra distorções de dados anômalos.

---

## 💰 Sistema de Custos

### Arquivo Central: `src/lib/modelCosts.ts`
Contém `MODEL_COSTS`, `DEPTH_TOKEN_ESTIMATES`, funções de cálculo.

### Hook: `useRealModelCosts`
Busca custos REAIS do banco e faz fallback para valores de referência.

### Cálculo com Mediana (AdminCosts)
```typescript
// Função de cálculo de mediana para proteção contra outliers
const calculateMedian = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};
```

### Cálculo Real (Edge Functions)
Tokens vêm da resposta da API (não estimativas). Custo = tokens × preço/token.

---

## 🪝 Hooks Principais

- `useAuth()` - Autenticação Supabase
- `useUserPlan()` - Plano do usuário + limites + features
- `useAdmin()` - Verificação de admin
- `useDashboardData()` - Dados consolidados via RPC
- `useRealModelCosts()` - Custos reais dos modelos

---

## 🧩 Componentes Chave

- `AnalysisPageLayout` - Layout compartilhado para análises
- `CheckableMarkdown` - Markdown com checklists interativos
- `SpendingAlert` - Alertas de limite de tokens
- `GitHubImportModal` - Import via PAT

---

## ⚙️ Configurações Importantes

### Variáveis de Ambiente (`.env`)
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

### Secrets Supabase
```
LOVABLE_API_KEY          # Auto-gerado
OPENAI_API_KEY           # Opcional
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

---

## 🐛 Troubleshooting

| Problema | Solução |
|----------|---------|
| Análise travada | Verificar `analysis_queue` e logs de `process-single-analysis` |
| Custo zero | Verificar `analysis_usage.tokens_estimated` |
| Plano não aplicando | Verificar `plans.config` e `useUserPlan` |
| Stripe não sincroniza | Verificar webhook secret e logs |
| Repo não encontrado | Repo deve ser público |
| Balanced > Complete em custos | Poucos dados - sistema usa mediana para proteção |

---

## 📝 Decisões de Design

- **Queue-based:** Edge Functions têm timeout ~6.7min. 10 análises requerem queue.
- **Token-based billing:** Mais justo que contagem de análises.
- **Cache github_data:** Evita re-fetch ao re-analisar.
- **Múltiplas versões:** Permite comparar análises em diferentes profundidades.
- **Custos centralizados:** `modelCosts.ts` evita duplicação.
- **Mediana vs Média:** Proteção contra outliers em cálculos de custos.
- **Tipo legado (ferramentas):** Mantido para compatibilidade, incorporado em `quality`.

---

## 🚀 Para Continuar o Desenvolvimento

### Adicionar novo tipo de análise:
1. Adicionar em `src/lib/analysisTypes.ts` (fonte única de verdade)
2. Criar prompt em `analysis_prompts` (via AdminPrompts)
3. Criar página em `/pages/`
4. Adicionar rota em `App.tsx`

### Adicionar novo modelo AI:
1. Adicionar em `MODEL_COSTS` (modelCosts.ts)
2. Adicionar custos em Edge Functions
3. Adicionar opção em AdminSettings

---

## 💻 Como Editar o Código

### Via Lovable
Acesse [Lovable Project](https://lovable.dev/projects/7d5991ba-592a-4aba-8411-c6580eee828b) e use prompts.

### Via IDE Local
```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm i
npm run dev
```

### Via GitHub Codespaces
1. Navegue ao repositório
2. Clique "Code" → "Codespaces" → "New codespace"

---

## 📞 Links Úteis

- **Docs Lovable:** https://docs.lovable.dev
- **Docs Supabase:** https://supabase.com/docs
- **Docs Stripe:** https://stripe.com/docs

---

*Última atualização: Dezembro 2024*
