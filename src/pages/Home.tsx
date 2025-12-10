import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Github, Sparkles, LogIn, LayoutDashboard, HelpCircle, Crown, AlertTriangle, 
  Zap, Scale, Rocket, Check, ChevronDown, ArrowRight, FileText, Target, 
  TrendingUp, Shield, Palette, Wrench, Lightbulb, BookOpen, Star, Loader2, Activity,
  Import
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserPlan } from "@/hooks/useUserPlan";
import { supabase } from "@/integrations/supabase/client";
import { GitHubImportModal } from "@/components/GitHubImportModal";
import { canUserAnalyze, suggestDepthBasedOnLimits } from "@/components/SpendingAlert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type AnalysisDepth = 'critical' | 'balanced' | 'complete';

interface DepthOption {
  id: AnalysisDepth;
  label: string;
  description: string;
  icon: React.ReactNode;
  context: string;
  savings: string;
  color: string;
}

const depthOptions: DepthOption[] = [
  { 
    id: 'critical', 
    label: 'Pontos Críticos', 
    description: 'Análise focada nos problemas mais importantes',
    icon: <Zap className="w-5 h-5" />,
    context: '~8KB',
    savings: '~75% economia',
    color: 'text-yellow-500'
  },
  { 
    id: 'balanced', 
    label: 'Balanceada', 
    description: 'Equilíbrio entre profundidade e velocidade',
    icon: <Scale className="w-5 h-5" />,
    context: '~20KB',
    savings: '~50% economia',
    color: 'text-blue-500'
  },
  { 
    id: 'complete', 
    label: 'Completa', 
    description: 'Análise detalhada com máximo contexto',
    icon: <Rocket className="w-5 h-5" />,
    context: '~40KB',
    savings: 'Máxima qualidade',
    color: 'text-green-500'
  },
];

interface AnalysisOption {
  id: string;
  label: string;
  description: string;
  icon: string;
  iconComponent: React.ReactNode;
  fullDescription: string;
}

const analysisOptions: AnalysisOption[] = [
  { id: "prd", label: "Análise PRD", description: "Documento técnico completo", icon: "📋", iconComponent: <FileText className="w-6 h-6" />, fullDescription: "Gera um Product Requirements Document completo com objetivos, público-alvo, arquitetura técnica e análise de riscos." },
  { id: "divulgacao", label: "Marketing & Lançamento", description: "Estratégia de marketing", icon: "📢", iconComponent: <Target className="w-6 h-6" />, fullDescription: "Estratégia completa de marketing digital, canais de aquisição, calendário editorial e métricas de sucesso." },
  { id: "captacao", label: "Pitch para Investidores", description: "Estratégia de investimentos", icon: "💰", iconComponent: <TrendingUp className="w-6 h-6" />, fullDescription: "Análise de mercado, proposta de valor para investidores, projeções financeiras e roadmap de crescimento." },
  { id: "seguranca", label: "Segurança", description: "Análise de vulnerabilidades", icon: "🛡️", iconComponent: <Shield className="w-6 h-6" />, fullDescription: "Identificação de vulnerabilidades, boas práticas de segurança, compliance e recomendações de proteção." },
  { id: "ui_theme", label: "UI/Theme", description: "Melhorias visuais", icon: "🎨", iconComponent: <Palette className="w-6 h-6" />, fullDescription: "Sugestões de design, paleta de cores, tipografia, componentes UI e melhorias de experiência do usuário." },
  { id: "ferramentas", label: "Ferramentas", description: "Otimizações de código", icon: "🔧", iconComponent: <Wrench className="w-6 h-6" />, fullDescription: "Análise de dependências, otimizações de performance, refatorações sugeridas e melhores práticas de código." },
  { id: "features", label: "Novas Features", description: "Sugestões de funcionalidades", icon: "✨", iconComponent: <Lightbulb className="w-6 h-6" />, fullDescription: "Novas funcionalidades baseadas em tendências de mercado, análise de concorrentes e feedback de usuários." },
  { id: "documentacao", label: "Documentação", description: "README e guias técnicos", icon: "📖", iconComponent: <BookOpen className="w-6 h-6" />, fullDescription: "README profissional, guia de instalação, referência de API, guia de contribuição e changelog." },
  { id: "prompts", label: "Prompts Otimizados", description: "Prompts para desenvolvimento", icon: "💻", iconComponent: <Sparkles className="w-6 h-6" />, fullDescription: "Prompts prontos para usar em ferramentas de IA (Cursor, Lovable, Copilot) para implementar funcionalidades do projeto." },
  { id: "quality", label: "Qualidade de Código", description: "Métricas de qualidade", icon: "📊", iconComponent: <Activity className="w-6 h-6" />, fullDescription: "Análise de complexidade ciclomática, manutenibilidade, cobertura de testes estimada e code smells." },
];

interface DynamicPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_analyses: number | null;
  daily_analyses: number | null;
  price_monthly: number | null;
  features: string[];
  is_active: boolean | null;
}

const faqs = [
  {
    question: "Como funciona a análise de projetos?",
    answer: "Nossa IA extrai informações do seu repositório GitHub (README, estrutura de arquivos, código-fonte) e gera análises detalhadas em português. O processo leva de 2 a 5 minutos dependendo do tamanho do projeto."
  },
  {
    question: "Meu repositório precisa ser público?",
    answer: "Sim, atualmente analisamos apenas repositórios públicos do GitHub. Se seu projeto é privado, você pode torná-lo público temporariamente para a análise e depois privatizá-lo novamente."
  },
  {
    question: "Quais tipos de análise estão disponíveis?",
    answer: "Oferecemos 8 tipos: PRD técnico, Plano de Divulgação, Plano de Captação, Análise de Segurança, Melhorias de UI/Theme, Otimizações de Ferramentas, Sugestões de Features e Documentação Técnica."
  },
  {
    question: "Posso exportar as análises?",
    answer: "Sim! Usuários dos planos Basic e Pro podem exportar todas as análises em formato PDF com formatação profissional."
  },
  {
    question: "As análises são salvas?",
    answer: "Sim, todas as análises ficam salvas no seu dashboard e você pode acessá-las a qualquer momento. Também oferecemos checklists interativos para acompanhar a implementação das sugestões."
  },
  {
    question: "Posso re-analisar um projeto?",
    answer: "Sim! Usuários Pro podem re-analisar projetos usando dados em cache (mais rápido) ou fazendo uma nova extração do GitHub para capturar mudanças recentes."
  }
];

const howItWorks = [
  {
    step: 1,
    title: "Cole a URL",
    description: "Insira a URL do seu repositório GitHub público"
  },
  {
    step: 2,
    title: "Escolha as Análises",
    description: "Selecione quais tipos de análise você deseja gerar"
  },
  {
    step: 3,
    title: "IA em Ação",
    description: "Nossa IA analisa o código e gera relatórios detalhados"
  },
  {
    step: 4,
    title: "Receba os Insights",
    description: "Acesse análises completas com checklists acionáveis"
  }
];

const Home = () => {
  const [githubUrl, setGithubUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [showAnalysisOptions, setShowAnalysisOptions] = useState(false);
  const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>(analysisOptions.map(a => a.id));
  const [selectedDepth, setSelectedDepth] = useState<AnalysisDepth>('complete');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [depthSuggestion, setDepthSuggestion] = useState<{ depth: AnalysisDepth; reason: string } | null>(null);
  const [plans, setPlans] = useState<DynamicPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading } = useAuth();
  const { plan, isLoading: planLoading } = useUserPlan();

  // Handle GitHub OAuth callback
  useEffect(() => {
    if (searchParams.get('github_connected') === 'true') {
      toast.success("Conta GitHub conectada com sucesso!");
      // Clear the query param
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  // Handler for GitHub import
  const handleGitHubImport = (url: string) => {
    setGithubUrl(url);
    setShowAnalysisOptions(true);
  };

  // Load plans dynamically from database
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const { data, error } = await supabase
          .from("plans")
          .select("*")
          .eq("is_active", true)
          .order("price_monthly", { ascending: true });

        if (error) throw error;
        
        setPlans(data?.map(p => ({
          ...p,
          features: Array.isArray(p.features) ? (p.features as string[]) : []
        })) || []);
      } catch (error) {
        console.error("Erro ao carregar planos:", error);
      } finally {
        setPlansLoading(false);
      }
    };
    loadPlans();
  }, []);

  // Filter out disabled analyses when plan loads
  useEffect(() => {
    if (!plan || plan.isAdmin) return;
    
    if (plan.allowedAnalysisTypes) {
      setSelectedAnalyses(prev => prev.filter(a => plan.allowedAnalysisTypes!.includes(a)));
    }
  }, [plan]);

  // Suggest optimal depth based on user limits
  useEffect(() => {
    if (!plan || plan.isAdmin || planLoading) {
      setDepthSuggestion(null);
      return;
    }

    const dailyRemaining = plan.dailyLimit - plan.dailyUsage;
    const monthlyRemaining = plan.monthlyLimit - plan.monthlyUsage;

    if (dailyRemaining <= 2 || monthlyRemaining <= 5) {
      const suggested = suggestDepthBasedOnLimits(plan);
      if (suggested !== 'complete') {
        setDepthSuggestion({
          depth: suggested,
          reason: dailyRemaining <= 2 
            ? `Você tem apenas ${dailyRemaining} análise(s) restante(s) hoje. Modo "${suggested === 'critical' ? 'Crítico' : 'Balanceado'}" é recomendado.`
            : `Você tem apenas ${monthlyRemaining} análise(s) restante(s) este mês. Considere economizar.`
        });
      } else {
        setDepthSuggestion(null);
      }
    } else {
      setDepthSuggestion(null);
    }
  }, [plan, planLoading]);

  const validateGithubUrl = (url: string): boolean => {
    const githubPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
    return githubPattern.test(url);
  };

  const handleUrlSubmit = () => {
    if (!githubUrl.trim()) {
      toast.error("Por favor, insira uma URL do GitHub");
      return;
    }

    if (!validateGithubUrl(githubUrl)) {
      toast.error("URL do GitHub inválida. Use o formato: https://github.com/usuario/repositorio");
      return;
    }

    setShowAnalysisOptions(true);
  };

  const handleAnalyze = async () => {
    if (!user) {
      toast.error("Você precisa estar logado para analisar projetos");
      navigate("/auth");
      return;
    }

    // Check limits using canUserAnalyze
    if (plan) {
      const { canAnalyze, reason } = canUserAnalyze(plan);
      if (!canAnalyze) {
        toast.error(reason);
        setShowUpgradeModal(true);
        return;
      }
    }

    if (selectedAnalyses.length === 0) {
      toast.error("Selecione pelo menos uma análise");
      return;
    }

    // Filter selected analyses by allowed types from plan config
    if (!plan?.isAdmin && plan?.allowedAnalysisTypes) {
      const allowedTypes = plan.allowedAnalysisTypes;
      const disallowedSelected = selectedAnalyses.filter(a => !allowedTypes.includes(a));
      if (disallowedSelected.length > 0) {
        toast.error(`Seu plano ${plan.planName} não permite algumas análises selecionadas. Faça upgrade para mais análises.`);
        setSelectedAnalyses(selectedAnalyses.filter(a => allowedTypes.includes(a)));
        return;
      }
    }
    
    // Validate depth is allowed
    if (!plan?.isAdmin && plan?.allowedDepths && !plan.allowedDepths.includes(selectedDepth)) {
      toast.error(`Seu plano ${plan.planName} não permite a profundidade "${selectedDepth}". Selecione outra opção.`);
      return;
    }

    setIsValidating(true);
    
    try {
      const analysisTypes = selectedAnalyses.join(",");
      navigate(`/analisando?url=${encodeURIComponent(githubUrl)}&analysisTypes=${analysisTypes}&depth=${selectedDepth}`);
    } catch (error) {
      toast.error("Erro ao iniciar análise");
      setIsValidating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleUrlSubmit();
    }
  };

  const toggleAnalysis = (id: string) => {
    setSelectedAnalyses(prev => 
      prev.includes(id) 
        ? prev.filter(a => a !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => setSelectedAnalyses(analysisOptions.map(a => a.id));
  const selectNone = () => setSelectedAnalyses([]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Github className="w-6 h-6 text-foreground" />
            <span className="font-semibold text-xl">GitAnalyzer</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollToSection('features')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </button>
            <button onClick={() => scrollToSection('how-it-works')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Como Funciona
            </button>
            <button onClick={() => scrollToSection('pricing')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Preços
            </button>
            <button onClick={() => scrollToSection('faq')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </button>
          </nav>
          {!isLoading && (
            user ? (
              <Button 
                variant="default" 
                onClick={() => navigate("/dashboard")}
                className="gap-2"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                onClick={() => navigate("/auth")}
                className="gap-2"
              >
                <LogIn className="w-4 h-4" />
                Entrar
              </Button>
            )
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary font-medium text-sm">
            <Sparkles className="w-4 h-4" />
            Análise Inteligente com IA
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
            Transforme seu projeto{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              GitHub
            </span>{" "}
            em insights acionáveis
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Nossa IA analisa seu repositório e gera 8 tipos de relatórios: PRD técnico, planos de marketing, análise de segurança, sugestões de features e muito mais.
          </p>

          {/* Input Section */}
          <div className="max-w-2xl mx-auto space-y-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <div className="relative">
              <Input
                type="url"
                placeholder="https://github.com/usuario/repositorio"
                value={githubUrl}
                onChange={(e) => {
                  setGithubUrl(e.target.value);
                  setShowAnalysisOptions(false);
                }}
                onKeyPress={handleKeyPress}
                className="h-14 text-base pl-12 pr-14 border-2 rounded-xl shadow-lg focus:shadow-xl transition-all"
                disabled={isValidating}
              />
              <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              
              <Dialog>
                <DialogTrigger asChild>
                  <button 
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground hover:text-foreground transition-colors"
                    type="button"
                  >
                    <HelpCircle className="w-5 h-5" />
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Como deixar seu projeto público</DialogTitle>
                    <DialogDescription>
                      Para analisar seu repositório, ele precisa estar público no GitHub.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-3">
                      {[
                        "Acesse seu repositório no GitHub",
                        "Clique em Settings (Configurações)",
                        "Role até a seção \"Danger Zone\"",
                        "Clique em \"Change repository visibility\"",
                        "Selecione \"Make public\" e confirme"
                      ].map((step, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium shrink-0">{i + 1}</div>
                          <p className="text-sm">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {!showAnalysisOptions ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button 
                  variant="hero" 
                  size="lg" 
                  className="w-full sm:w-auto px-12"
                  onClick={handleUrlSubmit}
                >
                  Analisar Projeto
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                
                {user && (
                  <GitHubImportModal 
                    onSelectRepo={handleGitHubImport}
                    trigger={
                      <Button 
                        variant="outline" 
                        size="lg"
                        className="w-full sm:w-auto gap-2"
                      >
                        <Import className="w-4 h-4" />
                        Importar do GitHub
                      </Button>
                    }
                  />
                )}
              </div>
            ) : (
              /* Analysis Options Panel */
              <div className="bg-card border border-border rounded-xl p-6 space-y-5 animate-fade-in text-left">
                {/* Depth Selector */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Scale className="w-4 h-4" />
                    Profundidade da Análise
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {depthOptions.map((option) => {
                      const isDepthAllowed = plan?.allowedDepths?.includes(option.id) ?? true;
                      const isDisabledDepth = !plan?.isAdmin && !isDepthAllowed;
                      
                      return (
                        <button
                          key={option.id}
                          onClick={() => !isDisabledDepth && setSelectedDepth(option.id)}
                          disabled={isDisabledDepth}
                          className={`p-4 rounded-lg border text-left transition-all relative ${
                            isDisabledDepth 
                              ? 'opacity-50 cursor-not-allowed bg-muted/30' 
                              : selectedDepth === option.id
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          {isDisabledDepth && (
                            <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">
                              PRO
                            </span>
                          )}
                          <div className="flex items-center gap-2 mb-1">
                            <span className={option.color}>{option.icon}</span>
                            <span className="font-medium text-sm">{option.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{option.description}</p>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Contexto: {option.context}</span>
                            <span className={`font-medium ${option.id === 'complete' ? 'text-green-500' : 'text-yellow-500'}`}>
                              {option.savings}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Depth Suggestion Alert */}
                  {depthSuggestion && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-yellow-600">{depthSuggestion.reason}</p>
                        {selectedDepth !== depthSuggestion.depth && (
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="h-auto p-0 text-yellow-600 underline"
                            onClick={() => setSelectedDepth(depthSuggestion.depth)}
                          >
                            Usar modo {depthSuggestion.depth === 'critical' ? 'Crítico' : 'Balanceado'}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Tipos de Análise</h3>
                      {user && plan && (
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          plan.planSlug === 'pro' ? 'bg-purple-500/10 text-purple-500' :
                          plan.planSlug === 'basic' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {plan.planName}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={selectAll}>Todas</Button>
                      <Button variant="ghost" size="sm" onClick={selectNone}>Nenhuma</Button>
                    </div>
                  </div>
                </div>

                {user && plan && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm">
                    <span className="text-muted-foreground">
                      {plan.isAdmin 
                        ? `Uso: ${plan.dailyUsage} hoje • ${plan.monthlyUsage} este mês (ilimitado)`
                        : `Uso: ${plan.dailyUsage}/${plan.dailyLimit} hoje • ${plan.monthlyUsage}/${plan.monthlyLimit} este mês`
                      }
                    </span>
                    {plan.planSlug === 'free' && !plan.isAdmin && (
                      <Button variant="link" size="sm" className="text-primary p-0 h-auto" onClick={() => setShowUpgradeModal(true)}>
                        <Crown className="w-3 h-3 mr-1" />
                        Upgrade
                      </Button>
                    )}
                  </div>
                )}

                {plan && !plan.canAnalyze && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{plan.limitMessage}</span>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysisOptions.map((option) => {
                    const isAnalysisAllowed = plan?.allowedAnalysisTypes?.includes(option.id) ?? true;
                    const isDisabled = !plan?.isAdmin && !isAnalysisAllowed;
                    
                    return (
                      <label
                        key={option.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'
                        } ${
                          selectedAnalyses.includes(option.id) && !isDisabled
                            ? "border-primary bg-primary/5" 
                            : "border-border"
                        }`}
                      >
                        <Checkbox
                          checked={selectedAnalyses.includes(option.id) && !isDisabled}
                          onCheckedChange={() => !isDisabled && toggleAnalysis(option.id)}
                          disabled={isDisabled}
                        />
                        <span className="text-xl">{option.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{option.label}</p>
                            {isDisabled && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">PRO</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{option.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {(() => {
                  // Calculate allowed analyses count
                  const allowedCount = plan?.isAdmin 
                    ? selectedAnalyses.length 
                    : selectedAnalyses.filter(a => plan?.allowedAnalysisTypes?.includes(a) ?? true).length;
                  
                  return (
                    <Button 
                      variant="hero" 
                      size="lg" 
                      className="w-full"
                      onClick={handleAnalyze}
                      disabled={isValidating || allowedCount === 0}
                    >
                      {isValidating ? "Iniciando..." : `Analisar (${allowedCount} análises)`}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-8 pt-8 text-muted-foreground text-sm">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Dados seguros</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Análise em minutos</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              <span>8 tipos de relatórios</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">8 Análises Completas</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Nossa IA gera relatórios detalhados em português, cobrindo todos os aspectos do seu projeto.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {analysisOptions.map((option, index) => (
              <Card 
                key={option.id} 
                className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/50"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {option.iconComponent}
                  </div>
                  <CardTitle className="text-lg">{option.label}</CardTitle>
                  <CardDescription>{option.fullDescription}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Como Funciona</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Em apenas 4 passos, transforme seu código em insights valiosos.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {howItWorks.map((item, index) => (
              <div key={item.step} className="text-center relative">
                <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Planos e Preços</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Escolha o plano ideal para suas necessidades. Cancele quando quiser.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plansLoading ? (
              <div className="col-span-3 flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : plans.map((p) => {
              const isPopular = p.slug === 'basic';
              const price = p.price_monthly === 0 ? 'R$ 0' : `R$ ${p.price_monthly?.toFixed(0)}`;
              const cta = p.slug === 'free' ? 'Começar Grátis' : `Assinar ${p.name}`;
              
              return (
                <Card 
                  key={p.id} 
                  className={`relative ${isPopular ? 'border-primary shadow-lg scale-105' : 'border-border/50'}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                      Mais Popular
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">{p.name}</CardTitle>
                    <CardDescription>{p.description}</CardDescription>
                    <div className="pt-4">
                      <span className="text-4xl font-bold">{price}</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-3">
                      {p.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-accent shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      variant={isPopular ? "default" : "outline"} 
                      className="w-full"
                      onClick={() => navigate("/auth")}
                    >
                      {cta}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Perguntas Frequentes</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Tire suas dúvidas sobre o GitAnalyzer.
            </p>
          </div>
          
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="bg-card border border-border rounded-lg px-6"
                >
                  <AccordionTrigger className="text-left hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para analisar seu projeto?
          </h2>
          <p className="text-primary-foreground/80 text-lg max-w-2xl mx-auto mb-8">
            Comece gratuitamente e descubra insights valiosos sobre seu código em minutos.
          </p>
          <Button 
            variant="secondary" 
            size="lg"
            className="px-12"
            onClick={() => scrollToSection('hero')}
          >
            Começar Agora
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Github className="w-6 h-6" />
                <span className="font-semibold text-lg">GitAnalyzer</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Análise inteligente de projetos GitHub com IA avançada.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-foreground transition-colors">Features</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className="hover:text-foreground transition-colors">Preços</button></li>
                <li><button onClick={() => scrollToSection('faq')} className="hover:text-foreground transition-colors">FAQ</button></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Sobre</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contato</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacidade</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border mt-12 pt-8 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} GitAnalyzer. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              Faça Upgrade do seu Plano
            </DialogTitle>
            <DialogDescription>
              {plan?.limitMessage || "Você atingiu o limite de análises do seu plano."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-3">
              <Card className="p-4 border-primary">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">Basic</h4>
                    <p className="text-sm text-muted-foreground">20 análises/mês • Todas análises</p>
                  </div>
                  <span className="font-bold">R$ 29/mês</span>
                </div>
              </Card>
              <Card className="p-4 border-accent">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">Pro</h4>
                    <p className="text-sm text-muted-foreground">Ilimitado • Re-análise com cache</p>
                  </div>
                  <span className="font-bold">R$ 79/mês</span>
                </div>
              </Card>
            </div>
            <Button className="w-full" onClick={() => scrollToSection('pricing')}>
              Ver Planos Completos
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
