import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Github, Home, Loader2, FileText, DollarSign, Lightbulb, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const History = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Erro ao carregar projetos:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
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
          <div className="flex items-center gap-2">
            <Github className="w-6 h-6 text-foreground" />
            <span className="font-semibold text-xl">GitAnalyzer</span>
          </div>
          <Button variant="ghost" onClick={() => navigate("/")}>
            <Home className="w-4 h-4" />
            Início
          </Button>
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
                      <h3 className="text-xl font-semibold mb-2">{project.name}</h3>
                      <a
                        href={project.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Github className="w-4 h-4" />
                        {project.github_url}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(project.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() => navigate(`/analise-prd/${project.id}`)}
                    >
                      <FileText className="w-4 h-4" />
                      Análise PRD
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() => navigate(`/plano-captacao/${project.id}`)}
                    >
                      <DollarSign className="w-4 h-4" />
                      Plano de Captação
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() => navigate(`/melhorias-features/${project.id}`)}
                    >
                      <Lightbulb className="w-4 h-4" />
                      Melhorias & Features
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
