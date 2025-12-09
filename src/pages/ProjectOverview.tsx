import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Github, 
  Loader2, 
  FileText, 
  Megaphone, 
  DollarSign, 
  Shield, 
  Palette, 
  Wrench, 
  Sparkles, 
  BookOpen, 
  Terminal,
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  MessageSquare,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { ViabilityScore } from "@/components/ViabilityScore";

interface Project {
  id: string;
  name: string;
  github_url: string;
  analysis_status: string;
  created_at: string;
}

interface Analysis {
  id: string;
  type: string;
  content: string;
  created_at: string;
}

const analysisConfig = [
  { type: "prd", title: "Análise PRD", icon: FileText, color: "text-blue-500", bgColor: "bg-blue-500/10", route: "/analise-prd" },
  { type: "divulgacao", title: "Marketing & Lançamento", icon: Megaphone, color: "text-purple-500", bgColor: "bg-purple-500/10", route: "/plano-divulgacao" },
  { type: "captacao", title: "Pitch para Investidores", icon: DollarSign, color: "text-green-500", bgColor: "bg-green-500/10", route: "/plano-captacao" },
  { type: "seguranca", title: "Segurança", icon: Shield, color: "text-red-500", bgColor: "bg-red-500/10", route: "/melhorias-seguranca" },
  { type: "ui_theme", title: "UI/Theme", icon: Palette, color: "text-pink-500", bgColor: "bg-pink-500/10", route: "/melhorias-ui" },
  { type: "ferramentas", title: "Ferramentas", icon: Wrench, color: "text-orange-500", bgColor: "bg-orange-500/10", route: "/melhorias-ferramentas" },
  { type: "features", title: "Novas Features", icon: Sparkles, color: "text-yellow-500", bgColor: "bg-yellow-500/10", route: "/novas-features" },
  { type: "documentacao", title: "Documentação", icon: BookOpen, color: "text-cyan-500", bgColor: "bg-cyan-500/10", route: "/documentacao-tecnica" },
  { type: "prompts", title: "Prompts Otimizados", icon: Terminal, color: "text-violet-500", bgColor: "bg-violet-500/10", route: "/prompts-otimizados" },
  { type: "quality", title: "Qualidade de Código", icon: Activity, color: "text-emerald-500", bgColor: "bg-emerald-500/10", route: "/qualidade-codigo" },
];

const ProjectOverview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        // Fetch project
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("*")
          .eq("id", id)
          .single();

        if (projectError) throw projectError;
        setProject(projectData);

        // Fetch all analyses for this project
        const { data: analysesData, error: analysesError } = await supabase
          .from("analyses")
          .select("*")
          .eq("project_id", id)
          .order("created_at", { ascending: false });

        if (analysesError) throw analysesError;
        setAnalyses(analysesData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Erro ao carregar dados do projeto");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const getLatestAnalysis = (type: string) => {
    return analyses.find(a => a.type === type);
  };

  const getAnalysisSummary = (content: string, maxLength = 150) => {
    // Extract first meaningful paragraph
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('|'));
    const summary = lines.slice(0, 2).join(' ').replace(/\*\*/g, '').replace(/[*_`]/g, '');
    return summary.length > maxLength ? summary.substring(0, maxLength) + '...' : summary;
  };

  const getCompletedCount = () => {
    const types = analysisConfig.map(a => a.type);
    return types.filter(type => getLatestAnalysis(type)).length;
  };

  const getPrdContent = () => {
    const prd = getLatestAnalysis('prd');
    return prd?.content || '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">Projeto não encontrado</p>
          <Button onClick={() => navigate("/dashboard")} className="mt-4">
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const completedCount = getCompletedCount();
  const totalAnalyses = analysisConfig.length;
  const progressPercentage = (completedCount / totalAnalyses) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(`/projeto/${id}`)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">{project.name}</h1>
                <a 
                  href={project.github_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  <Github className="w-3 h-3" />
                  {project.github_url.replace('https://github.com/', '')}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate(`/projeto/${id}/chat`)}
              className="gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Ask AI
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Progress Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Viability Score */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Viabilidade do Projeto
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getLatestAnalysis('prd') ? (
                <ViabilityScore content={getPrdContent()} />
              ) : (
                <div className="flex items-center justify-center h-24 text-muted-foreground">
                  <p className="text-sm">Execute a análise PRD para ver o score</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analysis Progress */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Progresso das Análises
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{completedCount}/{totalAnalyses}</span>
                  <Badge variant={completedCount === totalAnalyses ? "default" : "secondary"}>
                    {completedCount === totalAnalyses ? "Completo" : "Em progresso"}
                  </Badge>
                </div>
                <Progress value={progressPercentage} className="h-2" />
                <div className="flex flex-wrap gap-2">
                  {analysisConfig.map(config => {
                    const hasAnalysis = !!getLatestAnalysis(config.type);
                    return (
                      <Badge 
                        key={config.type}
                        variant="outline"
                        className={`${hasAnalysis ? config.bgColor + ' ' + config.color : 'opacity-40'}`}
                      >
                        {hasAnalysis ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                        {config.title}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analysis Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analysisConfig.map(config => {
            const analysis = getLatestAnalysis(config.type);
            const Icon = config.icon;
            
            return (
              <Card 
                key={config.type}
                className={`cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 ${
                  analysis ? '' : 'opacity-60 hover:opacity-80'
                }`}
                onClick={() => analysis && navigate(`${config.route}/${id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg ${config.bgColor}`}>
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    {analysis ? (
                      <Badge variant="default" className="text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Disponível
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        Pendente
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base mt-2">{config.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {analysis ? (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {getAnalysisSummary(analysis.content)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Análise ainda não executada
                    </p>
                  )}
                  {analysis && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Atualizado em {new Date(analysis.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default ProjectOverview;
