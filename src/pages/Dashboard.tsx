import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Github, Sparkles, LogOut, FolderGit2, BarChart3, Clock, Loader2, Grid3X3, Shield } from "lucide-react";
import { toast } from "sonner";
import { User, Session } from "@supabase/supabase-js";
import { useAdmin } from "@/hooks/useAdmin";

interface Project {
  id: string;
  name: string;
  github_url: string;
  created_at: string;
  analysis_status: string | null;
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [githubUrl, setGithubUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Erro ao buscar projetos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso");
    navigate("/");
  };

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
      toast.error("URL do GitHub inválida");
      return;
    }

    setIsValidating(true);
    navigate(`/analisando?url=${encodeURIComponent(githubUrl)}`);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return <span className="px-2 py-1 text-xs rounded-full bg-accent/10 text-accent">Concluído</span>;
      case "error":
        return <span className="px-2 py-1 text-xs rounded-full bg-destructive/10 text-destructive">Erro</span>;
      case "pending":
        return <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">Pendente</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Em andamento</span>;
    }
  };

  const stats = {
    total: projects.length,
    completed: projects.filter(p => p.analysis_status === "completed").length,
    recent: projects.slice(0, 3),
  };

  if (!user) {
    return null;
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
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user.email}
            </span>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                <Shield className="w-4 h-4 mr-2" />
                Admin
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Gerencie seus projetos e análises
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8 animate-slide-up">
          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <FolderGit2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Projetos analisados</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-sm text-muted-foreground">Análises completas</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total * 3}</p>
                <p className="text-sm text-muted-foreground">Relatórios gerados</p>
              </div>
            </div>
          </div>
        </div>

        {/* New Analysis */}
        <div className="mb-8 p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="text-lg font-semibold mb-4">Nova Análise</h2>
          <div className="flex gap-4 flex-col sm:flex-row">
            <div className="flex-1 relative">
              <Input
                type="url"
                placeholder="https://github.com/usuario/repositorio"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAnalyze()}
                className="h-12 pl-12"
                disabled={isValidating}
              />
              <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            </div>
            <Button
              variant="hero"
              size="lg"
              onClick={handleAnalyze}
              disabled={isValidating}
              className="h-12"
            >
              {isValidating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analisar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Projects List */}
        <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <h2 className="text-lg font-semibold mb-4">Meus Projetos</h2>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <FolderGit2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">Nenhum projeto ainda</h3>
              <p className="text-sm text-muted-foreground">
                Comece analisando seu primeiro repositório GitHub
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="p-4 bg-card border border-border rounded-xl hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium truncate">{project.name}</h3>
                        {getStatusBadge(project.analysis_status)}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {project.github_url}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(project.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    
                    {project.analysis_status === "completed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/projeto/${project.id}`)}
                      >
                        <Grid3X3 className="w-4 h-4 mr-1" />
                        Ver Análises
                      </Button>
                    )}
                    
                    {project.analysis_status && !["completed", "error", "pending"].includes(project.analysis_status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/analisando?projectId=${project.id}`)}
                      >
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Ver progresso
                      </Button>
                    )}
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

export default Dashboard;
