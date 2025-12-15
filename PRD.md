# 📄 PRD.md - GitAnalyzer

Product Requirements Document

---

## 1. Visão do Produto

### 1.1 Problema
Desenvolvedores e founders gastam horas analisando código, documentação e arquitetura de projetos GitHub para entender:
- Qualidade e manutenibilidade do código
- Oportunidades de melhoria técnica
- Potencial de mercado e estratégia de lançamento
- Vulnerabilidades de segurança
- Lacunas de documentação

### 1.2 Solução
GitAnalyzer é um SaaS que analisa repositórios GitHub usando IA avançada, gerando 10 tipos de análises abrangentes em minutos, incluindo PRD, estratégias de marketing, pitch para investidores, e análises técnicas detalhadas.

### 1.3 Proposta de Valor
- **Para desenvolvedores:** Economize horas de revisão manual com análises automáticas
- **Para founders:** Obtenha insights de negócio e documentos prontos para investidores
- **Para CTOs:** Avalie rapidamente a qualidade de projetos e equipes

---

## 2. Personas

### 2.1 Dev Solo (Diego, 28)
- **Contexto:** Desenvolvedor indie criando side projects
- **Dor:** Não tem tempo para documentar e planejar adequadamente
- **Ganho:** Documentação profissional e roadmap em minutos
- **Plano típico:** Free ou Starter

### 2.2 Tech Lead (Marina, 34)
- **Contexto:** Lidera equipe de 5-10 devs em startup
- **Dor:** Precisa avaliar qualidade de código e priorizar débito técnico
- **Ganho:** Análises de qualidade e segurança para tomada de decisão
- **Plano típico:** Basic ou Pro

### 2.3 Founder Técnico (Rafael, 42)
- **Contexto:** CTO de startup em estágio seed
- **Dor:** Precisa de materiais para investidores e estratégia de GTM
- **Ganho:** Pitch deck, PRD e plano de marketing automatizados
- **Plano típico:** Pro

### 2.4 Consultor (Ana, 38)
- **Contexto:** Consultora de transformação digital
- **Dor:** Avalia múltiplos projetos de clientes mensalmente
- **Ganho:** Análises padronizadas e profissionais rapidamente
- **Plano típico:** Pro ou Enterprise

---

## 3. Funcionalidades

### 3.1 Core Features

#### Análise de Repositório
| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| Input URL | Aceitar URLs de repos GitHub públicos | P0 |
| GitHub PAT | Suporte a repos privados via token | P0 |
| Seleção de tipos | Escolher quais análises gerar | P0 |
| Níveis de profundidade | Critical, Balanced, Complete | P0 |
| Cache de dados | Evitar re-fetch em re-análises | P1 |

#### Tipos de Análise (10)
| Tipo | Descrição | Persona Principal |
|------|-----------|-------------------|
| PRD | Product Requirements Document | Founder |
| Marketing | Estratégia de lançamento | Founder |
| Pitch | Material para investidores | Founder |
| Segurança | Vulnerabilidades e fixes | Tech Lead |
| UI/Theme | Melhorias de UX/UI | Dev Solo |
| Features | Sugestões de funcionalidades | Dev Solo |
| Documentação | README e docs técnicos | Dev Solo |
| Prompts | Prompts otimizados para IAs | Dev Solo |
| Qualidade | Métricas e code smells | Tech Lead |
| Performance | Core Web Vitals, observabilidade | Tech Lead |

#### Dashboard
| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| Lista de projetos | Ver todos os projetos analisados | P0 |
| Status de análises | Progresso em tempo real | P0 |
| Uso de tokens | Monitorar consumo do plano | P0 |
| Histórico | Últimas atividades | P1 |
| Busca e filtros | Encontrar projetos rapidamente | P1 |

### 3.2 Features Avançadas

#### Colaboração
| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| Ask AI | Chat contextual sobre o projeto | P1 |
| Plano de Implementação | Checklist de ações | P1 |
| Comparação de versões | Side-by-side diff | P2 |
| Exportação PDF | Download de análises | P1 |

#### Admin
| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| Gestão de usuários | CRUD de usuários | P0 |
| Gestão de planos | Pricing dinâmico | P0 |
| Análise de custos | ROI e projeções | P0 |
| Editor de prompts | Customizar análises | P1 |
| Configurações | Modelos AI, limites | P0 |

---

## 4. Requisitos Técnicos

### 4.1 Performance
- Tempo de análise: < 5 min para 10 tipos em Complete
- Latência de dashboard: < 2s P95
- Uptime: > 99.9%

### 4.2 Escalabilidade
- Suportar 100+ análises simultâneas
- Queue-based processing para evitar timeouts
- Cache eficiente de dados GitHub

### 4.3 Segurança
- RLS em todas as tabelas
- Tokens de API encriptados
- Anti-abuse de signup
- Rate limiting por tier

### 4.4 Integrações
- GitHub API v4 (GraphQL)
- Stripe Payments
- Lovable AI Gateway
- OpenAI API (opcional)

---

## 5. Modelo de Negócio

### 5.1 Pricing
| Plano | Preço | Tokens/Mês | Target |
|-------|-------|------------|--------|
| Free | R$ 0 | 50K | Trial |
| Starter | R$ 5 | 100K | Dev Solo |
| Basic | R$ 19.90 | 500K | Teams |
| Pro | R$ 49.90 | Ilimitado | Power Users |

### 5.2 Unit Economics (estimativa)
- CAC: R$ 50-100
- LTV: R$ 300-600 (12 meses)
- Margem bruta: 60-70%
- Payback: 2-3 meses

---

## 6. Backlog Priorizado

### Sprint Atual
- [ ] Proteção contra outliers com mediana ✅
- [ ] Reorganização de 10 tipos de análise ✅
- [ ] Documentação atualizada

### Próximo Sprint
- [ ] GitHub OAuth
- [ ] Onboarding flow
- [ ] Email transacional

### Backlog Futuro
- [ ] GitLab support
- [ ] Teams/Workspaces
- [ ] API pública
- [ ] Mobile app

---

## 7. Métricas e KPIs

### Aquisição
- Visitantes únicos/mês
- Taxa de conversão (visitante → signup)
- CAC por canal

### Ativação
- % usuários que completam primeira análise
- Tempo até primeira análise
- Taxa de conclusão do onboarding

### Retenção
- MAU / WAU / DAU
- Churn mensal
- Análises por usuário/mês

### Receita
- MRR / ARR
- ARPU
- Upgrade rate (Free → Paid)

### Satisfação
- NPS
- CSAT
- Feature adoption rate

---

## 8. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Custo de IA elevado | Alta | Alto | Modo econômico, caching agressivo |
| Rate limits GitHub | Média | Alto | Cache, autenticação OAuth |
| Concorrência | Média | Médio | Features diferenciadas, velocidade |
| Churn alto | Média | Alto | Onboarding, features stickiness |

---

## 9. Dependências

### Internas
- Design system (shadcn/ui)
- Edge functions (Supabase)
- Auth system

### Externas
- Lovable AI Gateway
- Stripe
- GitHub API
- OpenAI (opcional)

---

## 10. Critérios de Sucesso

### MVP (Atingido ✅)
- 8+ tipos de análise funcionais
- Sistema de billing integrado
- Dashboard funcional
- Admin panel básico

### v1.0 (Atingido ✅)
- 10 tipos de análise
- Token-based billing
- Ask AI
- Comparação de versões

### v2.0 (Em progresso)
- GitHub OAuth
- Internacionalização
- API pública
- Teams

---

*Última atualização: Dezembro 2024*
