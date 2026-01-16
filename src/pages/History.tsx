import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Github, 
  Home, 
  Loader2, 
  FileText, 
  DollarSign, 
  Calendar,
  LayoutDashboard,
  Megaphone,
  Shield,
  Palette,
  Wrench,
  Sparkles,
  BookOpen,
  CheckCircle,
  Clock,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const analysisTypes = [
  { type: "prd", title: "PRD", icon: FileText, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { type: "divulgacao", title: "Divulgação", icon: Megaphone, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  { type: "captacao", title: "Captação", icon: DollarSign, color: "text-green-500", bgColor: "bg-green-500/10" },
  { type: "seguranca", title: "Segurança", icon: Shield, color: "text-red-500", bgColor: "bg-red-500/10" },
  { type: "ui_theme", title: "UI/Theme", icon: Palette, color: "text-pink-500", bgColor: "bg-pink-500/10" },
  { type: "ferramentas", title: "Ferramentas", icon: Wrench, color: "text-orange-500", bgColor: "bg-orange-500/10" },
  { type: "features", title: "Features", icon: Sparkles, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  { type: "documentacao", title: "Documentação", icon: BookOpen, color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
];

interface ProjectAnalysis {
  type: string;
}

interface Project {
  id: string;
  name: string;
  github_url: string;
  created_at: string;
  analyses: ProjectAnalysis[];
}

const History = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      
      // Fetch projects with their analyses
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id, name, github_url, created_at")
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      // Fetch analyses for all projects
      const projectIds = projectsData?.map(p => p.id) || [];
      
      if (projectIds.length > 0) {
        const { data: analysesData } = await supabase
          .from("analyses")
          .select("project_id, type")
          .in("project_id", projectIds);

        // Map analyses to projects
        const projectsWithAnalyses = projectsData?.map(project => ({
          ...project,
          analyses: analysesData?.filter(a => a.project_id === project.id).map(a => ({ type: a.type })) || []
        })) || [];

        setProjects(projectsWithAnalyses);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error("Erro ao carregar projetos:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  };

  const hasAnalysis = (project: Project, type: string) => {
    return project.analyses.some(a => a.type === type);
  };

  const countAnalyses = (project: Project) => {
    return project.analyses.length;
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
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <Github className="w-6 h-6 text-foreground" />
            <span className="font-semibold text-xl">GitAnalyzer</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")}>
              <Home className="w-4 h-4 mr-2" />
              Início
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="space-y-8 animate-fade-in">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold">Histórico de Análises</h1>
            <p className="text-lg text-muted-foreground">
              {projects.length === 0 
                ? "Nenhum projeto analisado ainda" 
                : `${projects.length} projeto${projects.length > 1 ? "s" : ""} analisado${projects.length > 1 ? "s" : ""}`}
            </p>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Github className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Nenhuma análise ainda</h3>
              <p className="text-muted-foreground mb-6">
                Comece analisando seu primeiro projeto do GitHub
              </p>
              <Button onClick={() => navigate("/")}>
                Analisar Projeto
              </Button>
            </div>
          ) : (
            <div className="grid gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all animate-slide-up"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{project.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {countAnalyses(project)}/10 análises
                        </Badge>
                      </div>
                      <a
                        href={project.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Github className="w-4 h-4" />
                        {project.github_url}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(project.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                    </div>
                  </div>

                  {/* Analysis Types Grid */}
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-4">
                    {analysisTypes.map((analysis) => {
                      const Icon = analysis.icon;
                      const available = hasAnalysis(project, analysis.type);
                      
                      return (
                        <div
                          key={analysis.type}
                          className={`relative flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                            available 
                              ? `${analysis.bgColor} cursor-pointer hover:scale-105` 
                              : "bg-muted/30 opacity-50"
                          }`}
                          title={`${analysis.title}${available ? " - Disponível" : " - Não gerada"}`}
                        >
                          <Icon className={`w-5 h-5 ${available ? analysis.color : "text-muted-foreground"}`} />
                          <span className="text-[10px] text-center leading-tight">
                            {analysis.title}
                          </span>
                          {available ? (
                            <CheckCircle className="absolute -top-1 -right-1 w-3 h-3 text-green-500" />
                          ) : (
                            <Clock className="absolute -top-1 -right-1 w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Button */}
                  <div className="flex justify-end">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => navigate(`/projeto/${project.id}`)}
                    >
                      Ver Projeto
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default History;