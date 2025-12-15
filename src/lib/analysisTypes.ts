import { 
  FileText, 
  Megaphone, 
  DollarSign, 
  Shield, 
  Palette, 
  Sparkles, 
  BookOpen, 
  Terminal, 
  Activity, 
  Gauge,
  Wrench,
  LucideIcon
} from "lucide-react";

// Analysis type slugs - the canonical list
export const ANALYSIS_TYPE_SLUGS = [
  'prd', 
  'divulgacao', 
  'captacao', 
  'seguranca', 
  'ui_theme', 
  'features', 
  'documentacao', 
  'prompts', 
  'quality', 
  'performance'
] as const;

export type AnalysisTypeSlug = typeof ANALYSIS_TYPE_SLUGS[number];

// Legacy types that are still readable but not selectable for new analyses
export const LEGACY_ANALYSIS_TYPES = ['ferramentas'] as const;
export type LegacyAnalysisType = typeof LEGACY_ANALYSIS_TYPES[number];

// Depth levels
export const DEPTH_LEVELS = ['critical', 'balanced', 'complete'] as const;
export type DepthLevel = typeof DEPTH_LEVELS[number];

// Analysis type definition
export interface AnalysisTypeDefinition {
  slug: AnalysisTypeSlug;
  title: string;
  shortTitle: string;
  description: string;
  fullDescription: string;
  icon: LucideIcon;
  emoji: string;
  color: string;
  textColor: string;
  bgColor: string;
  route: string;
  stepLabel: string;
}

// Centralized analysis type definitions
export const ANALYSIS_TYPES: Record<AnalysisTypeSlug, AnalysisTypeDefinition> = {
  prd: {
    slug: 'prd',
    title: 'Análise PRD',
    shortTitle: 'PRD',
    description: 'Documento de requisitos do produto',
    fullDescription: 'Gera um Product Requirements Document completo com objetivos, público-alvo, arquitetura técnica e análise de riscos.',
    icon: FileText,
    emoji: '📋',
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    route: '/analise-prd',
    stepLabel: 'Gerando análise PRD',
  },
  divulgacao: {
    slug: 'divulgacao',
    title: 'Marketing & Lançamento',
    shortTitle: 'Marketing',
    description: 'Estratégias de marketing e comunicação',
    fullDescription: 'Estratégia completa de marketing digital, canais de aquisição, calendário editorial e métricas de sucesso.',
    icon: Megaphone,
    emoji: '📢',
    color: 'bg-purple-500',
    textColor: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    route: '/plano-divulgacao',
    stepLabel: 'Criando plano de marketing',
  },
  captacao: {
    slug: 'captacao',
    title: 'Pitch para Investidores',
    shortTitle: 'Pitch',
    description: 'Estratégias de investimento e recursos',
    fullDescription: 'Análise de mercado, proposta de valor para investidores, projeções financeiras e roadmap de crescimento.',
    icon: DollarSign,
    emoji: '💰',
    color: 'bg-green-500',
    textColor: 'text-green-500',
    bgColor: 'bg-green-500/10',
    route: '/plano-captacao',
    stepLabel: 'Criando pitch para investidores',
  },
  seguranca: {
    slug: 'seguranca',
    title: 'Melhorias de Segurança',
    shortTitle: 'Segurança',
    description: 'Vulnerabilidades e proteção de dados',
    fullDescription: 'Identificação de vulnerabilidades, boas práticas de segurança, compliance e recomendações de proteção.',
    icon: Shield,
    emoji: '🛡️',
    color: 'bg-red-500',
    textColor: 'text-red-500',
    bgColor: 'bg-red-500/10',
    route: '/melhorias-seguranca',
    stepLabel: 'Analisando segurança',
  },
  ui_theme: {
    slug: 'ui_theme',
    title: 'Melhorias UI/Theme',
    shortTitle: 'UI/Theme',
    description: 'Design e experiência do usuário',
    fullDescription: 'Sugestões de design, paleta de cores, tipografia, componentes UI e melhorias de experiência do usuário.',
    icon: Palette,
    emoji: '🎨',
    color: 'bg-pink-500',
    textColor: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    route: '/melhorias-ui',
    stepLabel: 'Sugerindo melhorias visuais',
  },
  features: {
    slug: 'features',
    title: 'Novas Features',
    shortTitle: 'Features',
    description: 'Sugestões de evolução do produto',
    fullDescription: 'Novas funcionalidades baseadas em tendências de mercado, análise de concorrentes e feedback de usuários.',
    icon: Sparkles,
    emoji: '✨',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    route: '/novas-features',
    stepLabel: 'Sugerindo novas features',
  },
  documentacao: {
    slug: 'documentacao',
    title: 'Documentação Técnica',
    shortTitle: 'Docs',
    description: 'README, API Reference e guias',
    fullDescription: 'README profissional, guia de instalação, referência de API, guia de contribuição e changelog.',
    icon: BookOpen,
    emoji: '📖',
    color: 'bg-cyan-500',
    textColor: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    route: '/documentacao-tecnica',
    stepLabel: 'Gerando documentação técnica',
  },
  prompts: {
    slug: 'prompts',
    title: 'Prompts Otimizados',
    shortTitle: 'Prompts',
    description: 'Prompts prontos para desenvolvimento',
    fullDescription: 'Prompts prontos para usar em ferramentas de IA (Cursor, Lovable, Copilot) para implementar funcionalidades do projeto.',
    icon: Terminal,
    emoji: '💻',
    color: 'bg-violet-500',
    textColor: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    route: '/prompts-otimizados',
    stepLabel: 'Gerando prompts otimizados',
  },
  quality: {
    slug: 'quality',
    title: 'Qualidade & Ferramentas',
    shortTitle: 'Qualidade',
    description: 'Qualidade de código, DX e tooling',
    fullDescription: 'Análise de qualidade de código, dependências, lint/format, CI/CD, scripts, bundling, boas práticas e recomendações de tooling.',
    icon: Activity,
    emoji: '📊',
    color: 'bg-emerald-500',
    textColor: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    route: '/qualidade-codigo',
    stepLabel: 'Analisando qualidade do código',
  },
  performance: {
    slug: 'performance',
    title: 'Performance & Observabilidade',
    shortTitle: 'Performance',
    description: 'Velocidade, logs e monitoramento',
    fullDescription: 'Core Web Vitals, otimização de bundle, lazy loading, queries, caching, logs estruturados, métricas e alertas.',
    icon: Gauge,
    emoji: '⚡',
    color: 'bg-amber-500',
    textColor: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    route: '/performance',
    stepLabel: 'Analisando performance',
  },
};

// Legacy type definition (for backward compatibility with ferramentas)
export const LEGACY_TYPE_DEFINITIONS: Record<LegacyAnalysisType, AnalysisTypeDefinition> = {
  ferramentas: {
    slug: 'ferramentas' as AnalysisTypeSlug,
    title: 'Melhorias de Ferramentas (Legado)',
    shortTitle: 'Ferramentas',
    description: 'Sugestões de ferramentas (descontinuado)',
    fullDescription: 'Esta análise foi incorporada em "Qualidade & Ferramentas".',
    icon: Wrench,
    emoji: '🔧',
    color: 'bg-gray-500',
    textColor: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    route: '/qualidade-codigo', // Redirect to quality page
    stepLabel: 'Analisando ferramentas',
  },
};

// Depth level definitions
export interface DepthLevelDefinition {
  id: DepthLevel;
  label: string;
  description: string;
  context: string;
  savings: string;
  color: string;
  badgeClass: string;
}

export const DEPTH_LEVEL_DEFINITIONS: Record<DepthLevel, DepthLevelDefinition> = {
  critical: {
    id: 'critical',
    label: 'Pontos Críticos',
    description: 'Análise focada nos problemas mais importantes',
    context: '~8KB',
    savings: '~75% economia',
    color: 'text-yellow-500',
    badgeClass: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  },
  balanced: {
    id: 'balanced',
    label: 'Balanceada',
    description: 'Equilíbrio entre profundidade e velocidade',
    context: '~20KB',
    savings: '~50% economia',
    color: 'text-blue-500',
    badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  complete: {
    id: 'complete',
    label: 'Completa',
    description: 'Análise detalhada com máximo contexto',
    context: '~40KB',
    savings: 'Máxima qualidade',
    color: 'text-green-500',
    badgeClass: 'bg-green-500/10 text-green-500 border-green-500/20',
  },
};

// Helper functions
export function getAnalysisType(slug: string): AnalysisTypeDefinition | null {
  if (slug in ANALYSIS_TYPES) {
    return ANALYSIS_TYPES[slug as AnalysisTypeSlug];
  }
  if (slug in LEGACY_TYPE_DEFINITIONS) {
    return LEGACY_TYPE_DEFINITIONS[slug as LegacyAnalysisType];
  }
  return null;
}

export function getAnalysisTypeTitle(slug: string): string {
  const type = getAnalysisType(slug);
  return type?.title || slug;
}

export function getAnalysisTypeRoute(slug: string): string {
  const type = getAnalysisType(slug);
  return type?.route || '/';
}

export function getDepthLevel(id: string): DepthLevelDefinition | null {
  if (id in DEPTH_LEVEL_DEFINITIONS) {
    return DEPTH_LEVEL_DEFINITIONS[id as DepthLevel];
  }
  return null;
}

// Array helpers for UI components
export function getAnalysisTypesArray(): AnalysisTypeDefinition[] {
  return Object.values(ANALYSIS_TYPES);
}

export function getDepthLevelsArray(): DepthLevelDefinition[] {
  return Object.values(DEPTH_LEVEL_DEFINITIONS);
}

// For admin/select components
export function getAnalysisTypesForSelect(): { key: string; name: string }[] {
  return Object.values(ANALYSIS_TYPES).map(t => ({
    key: t.slug,
    name: t.title,
  }));
}

export function getDepthLevelsForSelect(): { key: string; name: string; color: string }[] {
  return Object.values(DEPTH_LEVEL_DEFINITIONS).map(d => ({
    key: d.id,
    name: d.label,
    color: d.color,
  }));
}
