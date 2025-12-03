import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Github, 
  LogOut, 
  FolderGit2, 
  BarChart3, 
  Clock, 
  Loader2, 
  Grid3X3, 
  Shield,
  Crown,
  Zap,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  Activity,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { User, Session } from "@supabase/supabase-js";
import { useAdmin } from "@/hooks/useAdmin";
import { useUserPlan } from "@/hooks/useUserPlan";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

interface Project {
  id: string;
  name: string;
  github_url: string;
  created_at: string;
  analysis_status: string | null;
}

interface RecentActivity {
  id: string;
  type: 'project' | 'analysis' | 'checklist';
  description: string;
  timestamp: string;
  projectName?: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { plan, isLoading: planLoading } = useUserPlan();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [checklistStats, setChecklistStats] = useState({ completed: 0, total: 0 });
  const [totalTokens, setTotalTokens] = useState(0);
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    
    fetchProjects();
    fetchRecentActivities();
    fetchChecklistStats();
    fetchTokenUsage();
  }, [user, navigate]);

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

  const fetchRecentActivities = async () => {
    if (!user) return;
    
    try {
      // Buscar projetos recentes
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, name, created_at, analysis_status")
        .order("created_at", { ascending: false })
        .limit(5);

      // Buscar checklist items recentes
      const { data: checklistData } = await supabase
        .from("user_checklist_items")
        .select("id, completed_at, analysis_id")
        .eq("is_completed", true)
        .order("completed_at", { ascending: false })
        .limit(5);

      const activities: RecentActivity[] = [];

      projectsData?.forEach(p => {
        if (p.analysis_status === 'completed') {
          activities.push({
            id: `project-${p.id}`,
            type: 'project',
            description: `Análise concluída: ${p.name}`,
            timestamp: p.created_at,
            projectName: p.name,
          });
        }
      });

      checklistData?.forEach(c => {
        if (c.completed_at) {
          activities.push({
            id: `checklist-${c.id}`,
            type: 'checklist',
            description: 'Item de checklist concluído',
            timestamp: c.completed_at,
          });
        }
      });

      // Ordenar por timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setRecentActivities(activities.slice(0, 5));
    } catch (error) {
      console.error("Erro ao buscar atividades:", error);
    }
  };

  const fetchChecklistStats = async () => {
    if (!user) return;
    
    try {
      const { count: total } = await supabase
        .from("user_checklist_items")
        .select("*", { count: "exact", head: true });

      const { count: completed } = await supabase
        .from("user_checklist_items")
        .select("*", { count: "exact", head: true })
        .eq("is_completed", true);

      setChecklistStats({ completed: completed || 0, total: total || 0 });
    } catch (error) {
      console.error("Erro ao buscar estatísticas de checklist:", error);
    }
  };

  const fetchTokenUsage = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from("analysis_usage")
        .select("tokens_estimated");

      const total = data?.reduce((sum, u) => sum + (u.tokens_estimated || 0), 0) || 0;
      setTotalTokens(total);
    } catch (error) {
      console.error("Erro ao buscar uso de tokens:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso");
    navigate("/");
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return <span className="px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-500">Concluído</span>;
      case "error":
        return <span className="px-2 py-1 text-xs rounded-full bg-destructive/10 text-destructive">Erro</span>;
      case "pending":
        return <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">Pendente</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Em andamento</span>;
    }
  };

  const getPlanBadge = (planName: string) => {
    if (planName === 'Pro') return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    if (planName === 'Basic') return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    return 'bg-muted text-muted-foreground border-border';
  };

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays < 7) return `há ${diffDays}d`;
    return then.toLocaleDateString('pt-BR');
  };

  const stats = {
    total: projects.length,
    completed: projects.filter(p => p.analysis_status === "completed").length,
  };

  const dailyUsagePercent = plan ? Math.min((plan.dailyUsage / plan.dailyLimit) * 100, 100) : 0;
  const monthlyUsagePercent = plan ? Math.min((plan.monthlyUsage / plan.monthlyLimit) * 100, 100) : 0;
  const checklistPercent = checklistStats.total > 0 ? (checklistStats.completed / checklistStats.total) * 100 : 0;

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
            Gerencie seus projetos e acompanhe seu progresso
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Plan & Stats */}
          <div className="lg:col-span-2 space-y-6">
            {/* Plan Card */}
            <div className="p-6 bg-card border border-border rounded-xl animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Crown className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold">Seu Plano</h2>
                      {!planLoading && plan && (
                        <Badge className={getPlanBadge(plan.planName)}>
                          {plan.planName}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {plan?.planName === 'Free' ? 'Upgrade para mais análises' : 'Aproveite seus benefícios'}
                    </p>
                  </div>
                </div>
                {plan?.planName === 'Free' && (
                  <Button variant="hero" size="sm" onClick={() => navigate("/")}>
                    <Sparkles className="w-4 h-4 mr-1" />
                    Upgrade
                  </Button>
                )}
              </div>

              {!planLoading && plan && (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Daily Usage */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Uso Diário</span>
                      <span className="text-sm text-muted-foreground">
                        {plan.dailyUsage}/{plan.dailyLimit === 999999 ? '∞' : plan.dailyLimit}
                      </span>
                    </div>
                    <Progress value={plan.dailyLimit === 999999 ? 0 : dailyUsagePercent} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {plan.dailyLimit === 999999 ? 'Ilimitado' : `${plan.dailyLimit - plan.dailyUsage} restantes hoje`}
                    </p>
                  </div>

                  {/* Monthly Usage */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Uso Mensal</span>
                      <span className="text-sm text-muted-foreground">
                        {plan.monthlyUsage}/{plan.monthlyLimit === 999999 ? '∞' : plan.monthlyLimit}
                      </span>
                    </div>
                    <Progress value={plan.monthlyLimit === 999999 ? 0 : monthlyUsagePercent} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {plan.monthlyLimit === 999999 ? 'Ilimitado' : `${plan.monthlyLimit - plan.monthlyUsage} restantes este mês`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid md:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: "0.05s" }}>
              <div className="p-4 bg-card border border-border rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <FolderGit2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Projetos</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-card border border-border rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.completed}</p>
                    <p className="text-xs text-muted-foreground">Concluídos</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-card border border-border rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{(totalTokens / 1000).toFixed(1)}k</p>
                    <p className="text-xs text-muted-foreground">Tokens</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-card border border-border rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{checklistPercent.toFixed(0)}%</p>
                    <p className="text-xs text-muted-foreground">Checklist</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action */}
            <div className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl animate-slide-up" style={{ animationDelay: "0.1s" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-1">Analisar novo projeto</h3>
                  <p className="text-sm text-muted-foreground">
                    Inicie uma nova análise de repositório GitHub
                  </p>
                </div>
                <Button variant="hero" onClick={() => navigate("/")}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Nova Análise
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column - Recent Activities */}
          <div className="space-y-6">
            <div className="p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Atividades Recentes</h3>
              </div>
              
              {recentActivities.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        activity.type === 'project' ? 'bg-green-500/10' :
                        activity.type === 'checklist' ? 'bg-blue-500/10' :
                        'bg-primary/10'
                      }`}>
                        {activity.type === 'project' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <BarChart3 className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">{getRelativeTime(activity.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checklist Progress */}
            <div className="p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold">Progresso Checklist</h3>
              </div>
              
              <div className="text-center py-4">
                <div className="relative inline-flex items-center justify-center">
                  <svg className="w-24 h-24">
                    <circle
                      className="text-muted"
                      strokeWidth="8"
                      stroke="currentColor"
                      fill="transparent"
                      r="40"
                      cx="48"
                      cy="48"
                    />
                    <circle
                      className="text-green-500"
                      strokeWidth="8"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * checklistPercent) / 100}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="40"
                      cx="48"
                      cy="48"
                      style={{ transform: 'rotate(-90deg)', transformOrigin: '48px 48px' }}
                    />
                  </svg>
                  <span className="absolute text-2xl font-bold">{checklistPercent.toFixed(0)}%</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {checklistStats.completed} de {checklistStats.total} itens
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Projects List */}
        <div className="animate-slide-up" style={{ animationDelay: "0.25s" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Meus Projetos</h2>
            {projects.length > 0 && (
              <span className="text-sm text-muted-foreground">{projects.length} projeto(s)</span>
            )}
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <FolderGit2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">Nenhum projeto ainda</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Comece analisando seu primeiro repositório GitHub
              </p>
              <Button variant="hero" onClick={() => navigate("/")}>
                <Sparkles className="w-4 h-4 mr-2" />
                Começar Agora
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="p-4 bg-card border border-border rounded-xl hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group"
                  onClick={() => project.analysis_status === "completed" && navigate(`/projeto/${project.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                        {project.name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {project.github_url.replace("https://github.com/", "")}
                      </p>
                    </div>
                    {project.analysis_status === "completed" && (
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    {getStatusBadge(project.analysis_status)}
                    <span className="text-xs text-muted-foreground">
                      {new Date(project.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  
                  {project.analysis_status && !["completed", "error", "pending"].includes(project.analysis_status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/analisando?projectId=${project.id}`);
                      }}
                    >
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Ver progresso
                    </Button>
                  )}
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
