import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Github, Sparkles, LogIn, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const Home = () => {
  const [githubUrl, setGithubUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  const validateGithubUrl = (url: string): boolean => {
    const githubPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
    return githubPattern.test(url);
  };

  const handleAnalyze = async () => {
    if (!githubUrl.trim()) {
      toast.error("Por favor, insira uma URL do GitHub");
      return;
    }

    if (!validateGithubUrl(githubUrl)) {
      toast.error("URL do GitHub inválida. Use o formato: https://github.com/usuario/repositorio");
      return;
    }

    // Verificar se usuário está logado
    if (!user) {
      toast.error("Você precisa estar logado para analisar projetos");
      navigate("/auth");
      return;
    }

    setIsValidating(true);
    
    try {
      // Redirecionar para tela de análise
      navigate(`/analisando?url=${encodeURIComponent(githubUrl)}`);
    } catch (error) {
      toast.error("Erro ao iniciar análise");
      setIsValidating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAnalyze();
    }
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
                onChange={(e) => setGithubUrl(e.target.value)}
                onKeyPress={handleKeyPress}
                className="h-14 text-base pl-12 pr-4 border-2 rounded-xl shadow-lg focus:shadow-xl transition-all"
                disabled={isValidating}
              />
              <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            </div>
            
            <Button
              variant="hero"
              size="lg"
              onClick={handleAnalyze}
              disabled={isValidating}
              className="w-full h-14 text-base"
            >
              {isValidating ? (
                <>
                  <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  Validando...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Analisar Projeto
                </>
              )}
            </Button>
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
    </div>
  );
};

export default Home;
