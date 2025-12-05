import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  RefreshCw,
  Play,
  Zap,
  Scale,
  BarChart3,
  Flame,
  Leaf,
  Layers,
  GitCompare
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface AnalysisVersion {
  analysis_type: string;
  depth_level: string | null;
  model_used: string | null;
  created_at: string | null;
  mode: 'detailed' | 'economic';
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

const depthBadges: Record<string, { label: string; icon: typeof Zap; className: string }> = {
  critical: { label: "Crítico", icon: Zap, className: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  balanced: { label: "Balanceado", icon: Scale, className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  complete: { label: "Completo", icon: BarChart3, className: "bg-green-500/10 text-green-500 border-green-500/20" },
};

const ProjectHub = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [analysisVersions, setAnalysisVersions] = useState<AnalysisVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [selectedDepth, setSelectedDepth] = useState<"critical" | "balanced" | "complete">("balanced");
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; type: string; title: string; isGenerate: boolean }>({
    open: false,
    type: "",
    title: "",
    isGenerate: false
  });
  const [versionDialog, setVersionDialog] = useState<{ open: boolean; type: string; title: string; route: string; versions: AnalysisVersion[] }>({
    open: false,
    type: "",
    title: "",
    route: "",
    versions: []
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

        // Fetch all analysis versions with mode info
        const { data: usageData } = await supabase
          .from("analysis_usage")
          .select("analysis_type, depth_level, model_used, created_at")
          .eq("project_id", id)
          .order("created_at", { ascending: false });

        const versions: AnalysisVersion[] = (usageData || []).map(u => ({
          analysis_type: u.analysis_type,
          depth_level: u.depth_level,
          model_used: u.model_used,
          created_at: u.created_at,
          mode: u.model_used?.includes('lite') ? 'economic' : 'detailed'
        }));

        setAnalysisVersions(versions);
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

  const getDepthLevel = (type: string): string | null => {
    const versions = analysisVersions.filter(u => u.analysis_type === type);
    if (versions.length > 0) {
      return versions[0].depth_level;
    }
    return null;
  };

  const getVersionsForType = (type: string): AnalysisVersion[] => {
    return analysisVersions.filter(u => u.analysis_type === type);
  };

  const getUniqueVersions = (type: string): AnalysisVersion[] => {
    const versions = getVersionsForType(type);
    const unique = new Map<string, AnalysisVersion>();
    versions.forEach(v => {
      const key = `${v.mode}-${v.depth_level}`;
      if (!unique.has(key)) {
        unique.set(key, v);
      }
    });
    return Array.from(unique.values());
  };

  const hasMultipleVersions = (type: string): boolean => {
    return getUniqueVersions(type).length > 1;
  };

  const hasCachedData = () => {
    return project?.github_data !== null && project?.github_data !== undefined;
  };

  const handleGenerateOrReanalyze = async (type: string, isReanalyze: boolean) => {
    if (!project || !user) return;

    if (isReanalyze) {
      setReanalyzing(type);
    } else {
      setGenerating(type);
    }
    setConfirmDialog({ open: false, type: "", title: "", isGenerate: false });

    try {
      const { error } = await supabase.functions.invoke("analyze-github", {
        body: {
          githubUrl: project.github_url,
          userId: user.id,
          analysisTypes: [type],
          useCache: hasCachedData(),
          depth: selectedDepth
        }
      });

      if (error) throw error;

      toast.success(isReanalyze ? "Re-análise iniciada!" : "Análise iniciada!", {
        description: `Profundidade: ${depthBadges[selectedDepth].label}${hasCachedData() ? " • Usando cache" : ""}`
      });

      // Navigate to analyzing page
      navigate(`/analisando?projectId=${project.id}&analysisTypes=${type}`);

    } catch (error) {
      console.error("Erro ao analisar:", error);
      toast.error("Erro ao iniciar análise");
    } finally {
      setReanalyzing(null);
      setGenerating(null);
    }
  };

  const openConfirmDialog = (type: string, title: string, isGenerate: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({ open: true, type, title, isGenerate });
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
            const isGenerating = generating === analysis.type;
            const depthLevel = getDepthLevel(analysis.type);
            const depthBadge = depthLevel ? depthBadges[depthLevel] : null;
            const uniqueVersions = getUniqueVersions(analysis.type);
            const multipleVersions = uniqueVersions.length > 1;
            
            const handleCardClick = () => {
              if (!available) return;
              
              if (multipleVersions) {
                setVersionDialog({
                  open: true,
                  type: analysis.type,
                  title: analysis.title,
                  route: analysis.route,
                  versions: uniqueVersions
                });
              } else {
                navigate(`${analysis.route}/${id}`);
              }
            };
            
            return (
              <div
                key={analysis.type}
                className={`relative p-6 rounded-xl border transition-all duration-300 ${
                  available 
                    ? "bg-card border-border hover:shadow-lg hover:border-primary/30 cursor-pointer" 
                    : "bg-muted/30 border-border/50"
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={handleCardClick}
              >
                {/* Status indicator */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  {available && (
                    <button
                      onClick={(e) => openConfirmDialog(analysis.type, analysis.title, false, e)}
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

                {/* Badges row */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {available ? (
                    <>
                      <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-500">
                        Disponível
                      </span>
                      {depthBadge && (
                        <Badge variant="outline" className={`text-xs ${depthBadge.className}`}>
                          <depthBadge.icon className="w-3 h-3 mr-1" />
                          {depthBadge.label}
                        </Badge>
                      )}
                      {multipleVersions && (
                        <>
                          <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20">
                            <Layers className="w-3 h-3 mr-1" />
                            {uniqueVersions.length} versões
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/comparar/${id}?type=${analysis.type}`);
                            }}
                          >
                            <GitCompare className="w-3 h-3" />
                            Comparar
                          </Button>
                        </>
                      )}
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={(e) => openConfirmDialog(analysis.type, analysis.title, true, e)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Gerar Análise
                        </>
                      )}
                    </Button>
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

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.isGenerate ? "Gerar análise" : "Refazer análise"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  {confirmDialog.isGenerate 
                    ? `Deseja gerar a análise "${confirmDialog.title}"?`
                    : `Deseja refazer a análise "${confirmDialog.title}"?`
                  }
                </p>
                
                {/* Depth Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Profundidade da análise</label>
                  <Select value={selectedDepth} onValueChange={(v) => setSelectedDepth(v as typeof selectedDepth)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-orange-500" />
                          <div>
                            <span className="font-medium">Crítico</span>
                            <span className="text-muted-foreground ml-2">• Rápido e econômico</span>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="balanced">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-blue-500" />
                          <div>
                            <span className="font-medium">Balanceado</span>
                            <span className="text-muted-foreground ml-2">• Recomendado</span>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="complete">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-green-500" />
                          <div>
                            <span className="font-medium">Completo</span>
                            <span className="text-muted-foreground ml-2">• Análise detalhada</span>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {hasCachedData() ? (
                  <p className="text-sm text-green-600">
                    ✓ Dados do projeto em cache - economia de chamadas API
                  </p>
                ) : (
                  <p className="text-sm text-yellow-600">
                    ⚠ Será necessário extrair dados do GitHub
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleGenerateOrReanalyze(confirmDialog.type, !confirmDialog.isGenerate)}>
              {confirmDialog.isGenerate ? "Gerar Análise" : "Refazer Análise"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Version Selector Dialog */}
      <AlertDialog open={versionDialog.open} onOpenChange={(open) => setVersionDialog({ ...versionDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-500" />
              Selecionar versão
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Esta análise possui múltiplas versões. Selecione qual deseja visualizar:
                </p>
                
                <div className="space-y-2">
                  {versionDialog.versions.map((version, index) => {
                    const versionDepthBadge = version.depth_level ? depthBadges[version.depth_level] : null;
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          navigate(`${versionDialog.route}/${id}`);
                          setVersionDialog({ ...versionDialog, open: false });
                        }}
                        className="w-full p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {version.mode === 'detailed' ? (
                              <div className="p-2 rounded-lg bg-orange-500/10">
                                <Flame className="w-4 h-4 text-orange-500" />
                              </div>
                            ) : (
                              <div className="p-2 rounded-lg bg-green-500/10">
                                <Leaf className="w-4 h-4 text-green-500" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">
                                Modo {version.mode === 'detailed' ? 'Detalhado' : 'Econômico'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {version.created_at && new Date(version.created_at).toLocaleDateString("pt-BR", {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                          {versionDepthBadge && (
                            <Badge variant="outline" className={`text-xs ${versionDepthBadge.className}`}>
                              <versionDepthBadge.icon className="w-3 h-3 mr-1" />
                              {versionDepthBadge.label}
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectHub;