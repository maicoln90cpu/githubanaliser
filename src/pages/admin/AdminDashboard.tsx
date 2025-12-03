import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Github, 
  Home, 
  Loader2, 
  Users, 
  FolderGit2, 
  FileText, 
  BarChart3,
  Shield,
  Settings
} from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/useAdmin";

interface Stats {
  totalUsers: number;
  totalProjects: number;
  totalAnalyses: number;
  completedProjects: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalProjects: 0,
    totalAnalyses: 0,
    completedProjects: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (adminLoading) return;

    if (!isAdmin) {
      toast.error("Acesso negado. Área restrita para administradores.");
      navigate("/dashboard");
      return;
    }

    const loadStats = async () => {
      try {
        // Buscar total de projetos
        const { count: projectsCount } = await supabase
          .from("projects")
          .select("*", { count: "exact", head: true });

        // Buscar projetos completos
        const { count: completedCount } = await supabase
          .from("projects")
          .select("*", { count: "exact", head: true })
          .eq("analysis_status", "completed");

        // Buscar total de análises
        const { count: analysesCount } = await supabase
          .from("analyses")
          .select("*", { count: "exact", head: true });

        // Buscar usuários únicos dos projetos
        const { data: uniqueUsers } = await supabase
          .from("projects")
          .select("user_id")
          .not("user_id", "is", null);

        const uniqueUserIds = new Set(uniqueUsers?.map(p => p.user_id) || []);

        setStats({
          totalUsers: uniqueUserIds.size,
          totalProjects: projectsCount || 0,
          totalAnalyses: analysesCount || 0,
          completedProjects: completedCount || 0,
        });
      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
        toast.error("Erro ao carregar estatísticas");
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [isAdmin, adminLoading, navigate]);

  if (adminLoading || loading) {
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
            <span className="px-2 py-0.5 text-xs bg-red-500/10 text-red-500 rounded-full font-medium">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-red-500" />
            <h1 className="text-3xl font-bold">Painel Administrativo</h1>
          </div>
          <p className="text-muted-foreground">
            Visão geral do sistema e métricas
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-slide-up">
          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <p className="text-sm text-muted-foreground">Usuários</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <FolderGit2 className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalProjects}</p>
                <p className="text-sm text-muted-foreground">Projetos</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completedProjects}</p>
                <p className="text-sm text-muted-foreground">Concluídos</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalAnalyses}</p>
                <p className="text-sm text-muted-foreground">Análises</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div 
            className="p-6 bg-card border border-border rounded-xl hover:shadow-lg transition-all cursor-pointer"
            onClick={() => navigate("/admin/usuarios")}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Usuários</h3>
                <p className="text-sm text-muted-foreground">Ver todos os usuários</p>
              </div>
            </div>
            <Button variant="outline" className="w-full">
              Ver Usuários
            </Button>
          </div>

          <div 
            className="p-6 bg-card border border-border rounded-xl hover:shadow-lg transition-all cursor-pointer"
            onClick={() => navigate("/admin/projetos")}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <FolderGit2 className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Projetos</h3>
                <p className="text-sm text-muted-foreground">Ver todos os projetos</p>
              </div>
            </div>
            <Button variant="outline" className="w-full">
              Ver Projetos
            </Button>
          </div>

          <div 
            className="p-6 bg-card border border-border rounded-xl hover:shadow-lg transition-all cursor-pointer"
            onClick={() => navigate("/admin/custos")}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Custos</h3>
                <p className="text-sm text-muted-foreground">Análise de custos</p>
              </div>
            </div>
            <Button variant="outline" className="w-full">
              Ver Custos
            </Button>
          </div>

          <div 
            className="p-6 bg-card border border-border rounded-xl hover:shadow-lg transition-all cursor-pointer"
            onClick={() => navigate("/admin/planos")}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Planos</h3>
                <p className="text-sm text-muted-foreground">Gerenciar planos</p>
              </div>
            </div>
            <Button variant="outline" className="w-full">
              Ver Planos
            </Button>
          </div>

          <div 
            className="p-6 bg-card border border-border rounded-xl hover:shadow-lg transition-all cursor-pointer"
            onClick={() => navigate("/admin/configuracoes")}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Settings className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Configurações</h3>
                <p className="text-sm text-muted-foreground">Modo econômico/detalhado</p>
              </div>
            </div>
            <Button variant="outline" className="w-full">
              Configurar
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
