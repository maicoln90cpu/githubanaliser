# 📋 PENDENCIAS.md - GitAnalyzer

Status de features, pendências e changelog do sistema.

---

## ✅ Features Implementadas

### Core Analysis System
- [x] 10 tipos de análise ativos (PRD, Marketing, Pitch, Segurança, UI, Features, Docs, Prompts, Qualidade, Performance)
- [x] 3 níveis de profundidade (Critical, Balanced, Complete)
- [x] Sistema de queue para processamento assíncrono
- [x] Cache de dados do GitHub (`github_data` JSONB)
- [x] Re-análise com dados em cache
- [x] Múltiplas versões de análise por projeto
- [x] Comparação side-by-side de versões

### Authentication & Authorization
- [x] Autenticação Supabase (email/senha)
- [x] Sistema de roles (admin/user)
- [x] Anti-abuse por IP (signup_attempts)
- [x] GitHub PAT para repos privados

### Billing & Plans
- [x] 4 planos: Free, Starter, Basic, Pro
- [x] Billing baseado em tokens (não análises)
- [x] Integração Stripe completa
- [x] Webhooks automáticos
- [x] Portal do cliente Stripe
- [x] Sync bidirecional de planos

### Admin Panel
- [x] AdminDashboard - Overview de métricas
- [x] AdminUsers - Gestão de usuários
- [x] AdminProjects - Gestão de projetos
- [x] AdminCosts - Análise de custos (3 sub-tabs)
- [x] AdminPlans - Gestão de planos e simulador
- [x] AdminSettings - Configurações do sistema
- [x] AdminPrompts - Editor de prompts

### Cost Management
- [x] Rastreamento de tokens reais da API
- [x] Cálculo de custos em USD/BRL
- [x] **Proteção contra outliers com mediana** ✨
- [x] Rankings de modelos por custo
- [x] Simulador de cenários
- [x] Viabilidade por tokens

### UX Features
- [x] Dark/Light mode
- [x] Exportação PDF
- [x] Checklists interativos
- [x] Token estimation antes de análise
- [x] Alertas de limite de tokens
- [x] Progress bars de uso
- [x] Gráficos de consumo histórico

### AI Integration
- [x] Lovable AI Gateway (Gemini)
- [x] OpenAI (opcional)
- [x] Chat contextual (project-chat)
- [x] Plano de implementação on-demand

---

## 🔶 Análise Legado

### `ferramentas` (Tools Optimization)
- **Status:** Legado - apenas leitura
- **Motivo:** Incorporado em `quality` (Qualidade & Ferramentas)
- **Ação:** Análises antigas permanecem acessíveis via seção colapsável em AnalysisQuality
- **Redirect:** `/melhorias-ferramentas/:id` → `/qualidade-codigo/:id`

---

## 🚧 Pendências Técnicas

### Alta Prioridade
- [ ] Implementar rate limiting mais granular
- [ ] Adicionar logs estruturados em edge functions
- [ ] Melhorar error handling em Analyzing.tsx (polling stalls)
- [ ] Testes automatizados para fluxos críticos

### Média Prioridade
- [ ] Implementar retry automático em edge functions
- [ ] Adicionar métricas de latência por endpoint
- [ ] Cache de prompts em edge functions
- [ ] Otimizar queries de dashboard

### Baixa Prioridade
- [ ] Internacionalização (i18n)
- [ ] Notificações push
- [ ] Export para Notion/Confluence
- [ ] API pública documentada

---

## 💡 Sugestões Futuras

### Features de Análise
- [ ] Análise de commits/PRs recentes
- [ ] Análise de issues/discussions
- [ ] Comparação entre branches
- [ ] Análise de dependências com CVE check
- [ ] Score de manutenibilidade automático

### Integrações
- [ ] GitHub OAuth (substituir PAT)
- [ ] GitLab support
- [ ] Bitbucket support
- [ ] Slack notifications
- [ ] Discord bot

### Colaboração
- [ ] Workspaces/Teams
- [ ] Compartilhamento de análises
- [ ] Comentários em análises
- [ ] Export colaborativo

### Analytics
- [ ] Dashboard de tendências
- [ ] Comparação entre projetos
- [ ] Benchmarks de indústria
- [ ] Relatórios agendados

---

## 📝 Changelog

### v1.5.0 (Dezembro 2024)
- ✨ Implementada proteção contra outliers com mediana
- ✨ Reorganização para 10 tipos de análise
- ✨ Novo tipo: Performance & Observabilidade
- ✨ Tipo `ferramentas` marcado como legado
- 🔧 Correção de cálculos em AdminCosts
- 🔧 Centralização de tipos em `analysisTypes.ts`

### v1.4.0 (Dezembro 2024)
- ✨ Sistema de Recomendações Inteligentes
- ✨ Filtros de profundidade/modo/provider
- ✨ Notas explicativas em comparativos
- 🔧 Correção de tokens estáticos na tabela comparativa

### v1.3.0 (Novembro 2024)
- ✨ Plano Starter (R$ 5/mês)
- ✨ Token-based billing
- ✨ Stripe integration completa
- ✨ Admin sub-tabs organization

### v1.2.0 (Novembro 2024)
- ✨ Ask AI (chat contextual)
- ✨ Viability Score
- ✨ Project Overview dashboard
- ✨ GitHub PAT authentication

### v1.1.0 (Outubro 2024)
- ✨ Múltiplas versões de análise
- ✨ Comparação de versões
- ✨ Queue-based processing
- ✨ PDF export

### v1.0.0 (Outubro 2024)
- 🚀 Lançamento inicial
- ✨ 8 tipos de análise
- ✨ 3 profundidades
- ✨ Dashboard básico

---

*Última atualização: Dezembro 2024*
