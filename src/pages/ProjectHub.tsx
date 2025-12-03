import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Github, 
  Home, 
  Loader2, 
  FileText, 
  Megaphone, 
  DollarSign, 
  Shield, 
  Palette, 
  Wrench, 
  Sparkles,
  BookOpen,
  ExternalLink,
  CheckCircle,
  Clock,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Project {
  id: string;
  name: string;
  github_url: string;
  created_at: string;
  analysis_status: string;
  github_data: Record<string, unknown> | null;
}

interface Analysis {
  type: string;
  created_at: string;
}

const analysisTypes = [
  { 
    type: "prd", 
    title: "Análise PRD", 
    description: "Documento de requisitos do produto",
    icon: FileText, 
    color: "bg-blue-500",
    textColor: "text-blue-500",
    bgColor: "bg-blue-500/10",
    route: "/analise-prd"
  },
  { 
    type: "divulgacao", 
    title: "Plano de Divulgação", 
    description: "Estratégias de marketing e comunicação",
    icon: Megaphone, 
    color: "bg-purple-500",
    textColor: "text-purple-500",
    bgColor: "bg-purple-500/10",
    route: "/plano-divulgacao"
  },
  { 
    type: "captacao", 
    title: "Plano de Captação", 
    description: "Estratégias de investimento e recursos",
    icon: DollarSign, 
    color: "bg-green-500",
    textColor: "text-green-500",
    bgColor: "bg-green-500/10",
    route: "/plano-captacao"
  },
  { 
    type: "seguranca", 
    title: "Melhorias de Segurança", 
    description: "Vulnerabilidades e proteção de dados",
    icon: Shield, 
    color: "bg-red-500",
    textColor: "text-red-500",
    bgColor: "bg-red-500/10",
    route: "/melhorias-seguranca"
  },
  { 
    type: "ui_theme", 
    title: "Melhorias UI/Theme", 
    description: "Design e experiência do usuário",
    icon: Palette, 
    color: "bg-pink-500",
    textColor: "text-pink-500",
    bgColor: "bg-pink-500/10",
    route: "/melhorias-ui"
  },
  { 
    type: "ferramentas", 
    title: "Melhorias de Ferramentas", 
    description: "Otimização das funcionalidades existentes",
    icon: Wrench, 
    color: "bg-orange-500",
    textColor: "text-orange-500",
    bgColor: "bg-orange-500/10",
    route: "/melhorias-ferramentas"
  },
  { 
    type: "features", 
    title: "Novas Features", 
    description: "Sugestões de evolução do produto",
    icon: Sparkles, 
    color: "bg-yellow-500",
    textColor: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    route: "/novas-features"
  },
  { 
    type: "documentacao", 
    title: "Documentação Técnica", 
    description: "README, API Reference e guias",
    icon: BookOpen, 
    color: "bg-cyan-500",
    textColor: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    route: "/documentacao-tecnica"
  },
];

const ProjectHub = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; type: string; title: string }>({
    open: false,
    type: "",
    title: ""
  });

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/auth");
      return;
    }

    const loadData = async () => {
      try {
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("*")
          .eq("id", id)
          .single();

        if (projectError || !projectData) {
          toast.error("Projeto não encontrado");
          navigate("/dashboard");
          return;
        }

        setProject(projectData as Project);

        const { data: analysesData } = await supabase
          .from("analyses")
          .select("type, created_at")
          .eq("project_id", id);

        setAnalyses(analysesData || []);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast.error("Erro ao carregar projeto");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, navigate, user, authLoading]);

  const hasAnalysis = (type: string) => {
    return analyses.some(a => a.type === type);
  };

  const hasCachedData = () => {
    return project?.github_data !== null && project?.github_data !== undefined;
  };

  const handleReanalyze = async (type: string) => {
    if (!project || !user) return;

    setReanalyzing(type);
    setConfirmDialog({ open: false, type: "", title: "" });

    try {
      const { error } = await supabase.functions.invoke("analyze-github", {
        body: {
          githubUrl: project.github_url,
          userId: user.id,
          analysisTypes: [type],
          useCache: hasCachedData()
        }
      });

      if (error) throw error;

      toast.success("Re-análise iniciada!", {
        description: hasCachedData() 
          ? "Usando dados em cache para economizar recursos"
          : "Extraindo dados do GitHub"
      });

      // Navigate to analyzing page
      navigate(`/analisando?projectId=${project.id}&analysisTypes=${type}`);

    } catch (error) {
      console.error("Erro ao re-analisar:", error);
      toast.error("Erro ao iniciar re-análise");
    } finally {
      setReanalyzing(null);
    }
  };

  const openConfirmDialog = (type: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({ open: true, type, title });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <Github className="w-6 h-6 text-foreground" />
            <span className="font-semibold text-xl">GitAnalyzer</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <Home className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Project Info */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center">
              <Github className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{project?.name}</h1>
              <a 
                href={project?.github_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                {project?.github_url}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-muted-foreground">
              Selecione uma análise para visualizar os detalhes
            </p>
            {hasCachedData() && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-500 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Dados em cache
              </span>
            )}
          </div>
        </div>

        {/* Analysis Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-slide-up">
          {analysisTypes.map((analysis, index) => {
            const Icon = analysis.icon;
            const available = hasAnalysis(analysis.type);
            const isReanalyzing = reanalyzing === analysis.type;
            
            return (
              <div
                key={analysis.type}
                className={`relative p-6 rounded-xl border transition-all duration-300 ${
                  available 
                    ? "bg-card border-border hover:shadow-lg hover:border-primary/30 cursor-pointer" 
                    : "bg-muted/30 border-border/50 opacity-60"
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => available && navigate(`${analysis.route}/${id}`)}
              >
                {/* Status indicator */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  {available && (
                    <button
                      onClick={(e) => openConfirmDialog(analysis.type, analysis.title, e)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      title="Refazer análise"
                      disabled={isReanalyzing}
                    >
                      {isReanalyzing ? (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-muted-foreground hover:text-primary" />
                      )}
                    </button>
                  )}
                  {available ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>

                {/* Icon */}
                <div className={`w-12 h-12 rounded-lg ${analysis.bgColor} flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 ${analysis.textColor}`} />
                </div>

                {/* Content */}
                <h3 className="font-semibold mb-1">{analysis.title}</h3>
                <p className="text-sm text-muted-foreground">{analysis.description}</p>

                {/* Availability badge */}
                <div className="mt-4">
                  {available ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-500">
                      Disponível
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      Não gerada
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Back Button */}
        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Voltar ao Dashboard
          </Button>
        </div>
      </main>

      {/* Confirm Re-analysis Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refazer análise</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja refazer a análise <strong>"{confirmDialog.title}"</strong>?
              {hasCachedData() ? (
                <span className="block mt-2 text-green-600">
                  ✓ Dados do projeto em cache - economia de chamadas API
                </span>
              ) : (
                <span className="block mt-2 text-yellow-600">
                  ⚠ Será necessário extrair dados do GitHub novamente
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleReanalyze(confirmDialog.type)}>
              Refazer Análise
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectHub;
