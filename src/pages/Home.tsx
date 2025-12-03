import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Github, Sparkles, LogIn, LayoutDashboard, HelpCircle, Crown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserPlan } from "@/hooks/useUserPlan";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AnalysisOption {
  id: string;
  label: string;
  description: string;
  icon: string;
}

const analysisOptions: AnalysisOption[] = [
  { id: "prd", label: "Análise PRD", description: "Documento técnico completo", icon: "📋" },
  { id: "divulgacao", label: "Plano de Divulgação", description: "Estratégia de marketing", icon: "📢" },
  { id: "captacao", label: "Plano de Captação", description: "Estratégia de investimentos", icon: "💰" },
  { id: "seguranca", label: "Segurança", description: "Análise de vulnerabilidades", icon: "🛡️" },
  { id: "ui_theme", label: "UI/Theme", description: "Melhorias visuais", icon: "🎨" },
  { id: "ferramentas", label: "Ferramentas", description: "Otimizações de código", icon: "🔧" },
  { id: "features", label: "Novas Features", description: "Sugestões de funcionalidades", icon: "✨" },
];

const Home = () => {
  const [githubUrl, setGithubUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [showAnalysisOptions, setShowAnalysisOptions] = useState(false);
  const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>(analysisOptions.map(a => a.id));
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { plan, isLoading: planLoading } = useUserPlan();

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

    // Mostrar opções de análise
    setShowAnalysisOptions(true);
  };

  const handleAnalyze = async () => {
    // Verificar se usuário está logado
    if (!user) {
      toast.error("Você precisa estar logado para analisar projetos");
      navigate("/auth");
      return;
    }

    // Verificar limites do plano
    if (plan && !plan.canAnalyze) {
      setShowUpgradeModal(true);
      return;
    }

    if (selectedAnalyses.length === 0) {
      toast.error("Selecione pelo menos uma análise");
      return;
    }

    // Verificar se plano Free está tentando usar análises avançadas
    if (plan?.planSlug === 'free') {
      const basicAnalyses = ['prd', 'divulgacao', 'captacao'];
      const advancedSelected = selectedAnalyses.filter(a => !basicAnalyses.includes(a));
      if (advancedSelected.length > 0) {
        toast.error("Plano Free permite apenas PRD, Divulgação e Captação. Faça upgrade para mais análises.");
        setSelectedAnalyses(selectedAnalyses.filter(a => basicAnalyses.includes(a)));
        return;
      }
    }

    setIsValidating(true);
    
    try {
      // Redirecionar para tela de análise com as opções selecionadas
      const analysisTypes = selectedAnalyses.join(",");
      navigate(`/analisando?url=${encodeURIComponent(githubUrl)}&analysisTypes=${analysisTypes}`);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Github className="w-6 h-6 text-foreground" />
            <span className="font-semibold text-xl">GitAnalyzer</span>
          </div>
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
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-8 animate-fade-in">
          {/* Title */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-light rounded-full text-primary font-medium text-sm">
              <Sparkles className="w-4 h-4" />
              Análise Inteligente com IA
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Analise qualquer projeto{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                GitHub
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Nossa IA gera análises completas: PRD técnico, plano de captação e sugestões de melhorias.
            </p>
          </div>

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
              
              {/* Botão de ajuda */}
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
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium shrink-0">1</div>
                        <p className="text-sm">Acesse seu repositório no GitHub</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium shrink-0">2</div>
                        <p className="text-sm">Clique em <strong>Settings</strong> (Configurações) no menu do repositório</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium shrink-0">3</div>
                        <p className="text-sm">Role até a seção <strong>"Danger Zone"</strong> no final da página</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium shrink-0">4</div>
                        <p className="text-sm">Clique em <strong>"Change repository visibility"</strong></p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium shrink-0">5</div>
                        <p className="text-sm">Selecione <strong>"Make public"</strong> e confirme a ação</p>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        <strong>Dica:</strong> Após a análise, você pode tornar o repositório privado novamente se desejar.
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Analysis Options */}
            {showAnalysisOptions && (
              <div className="bg-card border border-border rounded-xl p-6 space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Selecione as análises desejadas</h3>
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

                {/* Plan usage info */}
                {user && plan && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm">
                    <span className="text-muted-foreground">
                      Uso: {plan.dailyUsage}/{plan.dailyLimit} hoje • {plan.monthlyUsage}/{plan.monthlyLimit} este mês
                    </span>
                    {plan.planSlug === 'free' && (
                      <Button variant="link" size="sm" className="text-primary p-0 h-auto" onClick={() => setShowUpgradeModal(true)}>
                        <Crown className="w-3 h-3 mr-1" />
                        Upgrade
                      </Button>
                    )}
                  </div>
                )}

                {/* Limit warning */}
                {plan && !plan.canAnalyze && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{plan.limitMessage}</span>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysisOptions.map((option) => {
                    const isBasicAnalysis = ['prd', 'divulgacao', 'captacao'].includes(option.id);
                    const isDisabled = plan?.planSlug === 'free' && !isBasicAnalysis;
                    
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
                          checked={selectedAnalyses.includes(option.id)}
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

                <Button
                  variant="hero"
                  size="lg"
                  onClick={handleAnalyze}
                  disabled={isValidating || selectedAnalyses.length === 0 || (plan && !plan.canAnalyze)}
                  className="w-full h-14 text-base"
                >
                  {isValidating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Analisar {selectedAnalyses.length} {selectedAnalyses.length === 1 ? "item" : "itens"}
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {!showAnalysisOptions && (
              <Button
                variant="hero"
                size="lg"
                onClick={handleUrlSubmit}
                disabled={isValidating}
                className="w-full h-14 text-base"
              >
                <Sparkles className="w-5 h-5" />
                Continuar
              </Button>
            )}
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 pt-12 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <div className="p-6 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📋</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Análise PRD</h3>
              <p className="text-sm text-muted-foreground">
                Documento técnico completo com arquitetura, objetivos e riscos do projeto
              </p>
            </div>

            <div className="p-6 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-accent-light rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">💰</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Plano de Captação</h3>
              <p className="text-sm text-muted-foreground">
                Estratégias de marketing e copy para divulgar seu produto
              </p>
            </div>

            <div className="p-6 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">✨</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Melhorias & Features</h3>
              <p className="text-sm text-muted-foreground">
                Sugestões técnicas e roadmap para evolução do projeto
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              Faça Upgrade do seu Plano
            </DialogTitle>
            <DialogDescription>
              {plan?.limitMessage || "Você atingiu o limite do seu plano atual."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-semibold mb-2">Basic</h4>
                <p className="text-2xl font-bold mb-2">R$29,90<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• 20 projetos/mês</li>
                  <li>• 5 projetos/dia</li>
                  <li>• 7 tipos de análise</li>
                </ul>
              </div>
              <div className="p-4 border-2 border-primary rounded-lg relative">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                  Popular
                </div>
                <h4 className="font-semibold mb-2">Pro</h4>
                <p className="text-2xl font-bold mb-2">R$79,90<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• 100 projetos/mês</li>
                  <li>• 15 projetos/dia</li>
                  <li>• Re-análise individual</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Em breve: pagamento integrado com Stripe
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowUpgradeModal(false)}>
              Depois
            </Button>
            <Button className="flex-1" onClick={() => {
              toast.info("Sistema de pagamento em desenvolvimento");
              setShowUpgradeModal(false);
            }}>
              Escolher Plano
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
