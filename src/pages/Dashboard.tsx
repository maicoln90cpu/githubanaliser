import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Github, 
  LogOut, 
  FolderGit2, 
  BarChart3, 
  Clock, 
  Loader2, 
  Shield,
  Crown,
  Zap,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  Activity,
  TrendingUp,
  Search,
  Star,
  Trash2,
  ArrowUpDown,
  X,
  HelpCircle
} from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/useAdmin";
import { useUserPlan } from "@/hooks/useUserPlan";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Badge } from "@/components/ui/badge";
import { SpendingAlert } from "@/components/SpendingAlert";
import { EmptyState } from "@/components/EmptyState";
import { ThemeToggle } from "@/components/ThemeToggle";

const ITEMS_PER_PAGE = 12;

// Skeleton Components
const ProjectCardSkeleton = () => (
  <div className="p-4 bg-card border border-border rounded-xl">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <div className="flex items-center justify-between">
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="h-4 w-16" />
    </div>
  </div>
);

const StatsCardSkeleton = () => (
  <div className="p-4 bg-card border border-border rounded-xl">
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  </div>
);

const ActivitySkeleton = () => (
  <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
    <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/4" />
    </div>
  </div>
);

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'status';
type StatusFilter = 'all' | 'completed' | 'in-progress' | 'error' | 'pending';

const Dashboard = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { plan, isLoading: planLoading } = useUserPlan();
  const { 
    projects, 
    recentActivities, 
    checklistStats, 
    totalTokens, 
    isLoading,
    refetch
  } = useDashboardData(user?.id);
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();

  // Filter, search, and sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("date-desc");
  
  // Pagination state
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Selection state for batch actions
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Redirect if not authenticated
  if (!authLoading && !user) {
    navigate("/auth", { replace: true });
    return null;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso");
    navigate("/");
  };

  const togglePinProject = async (projectId: string, currentPinned: boolean) => {
    const { error } = await supabase
      .from('projects')
      .update({ is_pinned: !currentPinned })
      .eq('id', projectId);

    if (error) {
      toast.error("Erro ao atualizar favorito");
    } else {
      toast.success(currentPinned ? "Removido dos favoritos" : "Adicionado aos favoritos");
      refetch();
    }
  };

  const toggleSelectProject = (projectId: string) => {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    const visibleIds = filteredAndSortedProjects.map(p => p.id);
    setSelectedProjects(new Set(visibleIds));
  };

  const clearSelection = () => {
    setSelectedProjects(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedProjects.size === 0) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .in('id', Array.from(selectedProjects));

      if (error) throw error;

      toast.success(`${selectedProjects.size} projeto(s) excluído(s)`);
      setSelectedProjects(new Set());
      setShowDeleteDialog(false);
      refetch();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Erro ao excluir projetos");
    } finally {
      setIsDeleting(false);
    }
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

  // Filter and sort projects
  const filteredAndSortedProjects = useMemo(() => {
    let filtered = [...projects];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.github_url.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => {
        const status = p.analysis_status;
        switch (statusFilter) {
          case 'completed':
            return status === 'completed';
          case 'error':
            return status === 'error';
          case 'pending':
            return status === 'pending';
          case 'in-progress':
            return status && !['completed', 'error', 'pending'].includes(status);
          default:
            return true;
        }
      });
    }

    // Sort - pinned first, then by sort option
    filtered.sort((a, b) => {
      // Pinned projects first
      const aPinned = (a as any).is_pinned || false;
      const bPinned = (b as any).is_pinned || false;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // Then sort by selected option
      switch (sortOption) {
        case 'date-desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date-asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'status':
          const statusOrder: Record<string, number> = { 'completed': 0, 'error': 1, 'pending': 2 };
          const aOrder = statusOrder[a.analysis_status || ''] ?? 3;
          const bOrder = statusOrder[b.analysis_status || ''] ?? 3;
          return aOrder - bOrder;
        default:
          return 0;
      }
    });

    return filtered;
  }, [projects, searchQuery, statusFilter, sortOption]);

  // Paginated projects for display
  const paginatedProjects = useMemo(() => {
    return filteredAndSortedProjects.slice(0, visibleCount);
  }, [filteredAndSortedProjects, visibleCount]);

  const hasMore = visibleCount < filteredAndSortedProjects.length;

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchQuery, statusFilter, sortOption]);

  // Infinite scroll with Intersection Observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount(prev => prev + ITEMS_PER_PAGE);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore]);

  const stats = {
    total: projects.length,
    completed: projects.filter(p => p.analysis_status === "completed").length,
  };

  const statusCounts = useMemo(() => ({
    all: projects.length,
    completed: projects.filter(p => p.analysis_status === "completed").length,
    inProgress: projects.filter(p => p.analysis_status && !['completed', 'error', 'pending'].includes(p.analysis_status)).length,
    error: projects.filter(p => p.analysis_status === "error").length,
    pending: projects.filter(p => p.analysis_status === "pending").length,
  }), [projects]);

  const dailyUsagePercent = plan ? Math.min((plan.dailyUsage / plan.dailyLimit) * 100, 100) : 0;
  const monthlyUsagePercent = plan ? Math.min((plan.monthlyUsage / plan.monthlyLimit) * 100, 100) : 0;
  const checklistPercent = checklistStats.total > 0 ? (checklistStats.completed / checklistStats.total) * 100 : 0;

  // Show loading while auth is being determined
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 transition-all duration-300">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer hover-lift" onClick={() => navigate("/")}>
            <Github className="w-6 h-6 text-foreground" />
            <span className="font-semibold text-xl">GitAnalyzer</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user.email}
            </span>
            <ThemeToggle />
            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                    <Shield className="w-4 h-4 mr-2" />
                    Admin
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Acessar painel administrativo</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Encerrar sessão</p>
              </TooltipContent>
            </Tooltip>
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
                <div className="space-y-4">
                  {/* Token Usage - Primary */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Tokens Mensais</span>
                      <span className="text-sm text-muted-foreground">
                        {plan.maxTokensMonthly === null ? (
                          '∞ Ilimitado'
                        ) : (
                          `${(plan.tokensUsed / 1000).toFixed(1)}K / ${(plan.maxTokensMonthly / 1000).toFixed(0)}K`
                        )}
                      </span>
                    </div>
                    <Progress 
                      value={plan.maxTokensMonthly === null ? 0 : plan.tokensUsedPercent} 
                      className={`h-3 ${plan.tokensUsedPercent >= 80 ? 'bg-yellow-500/20' : ''}`} 
                    />
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">
                        {plan.maxTokensMonthly === null 
                          ? 'Sem limite de tokens' 
                          : plan.tokensRemaining !== null 
                            ? `${(plan.tokensRemaining / 1000).toFixed(1)}K tokens restantes`
                            : ''
                        }
                      </p>
                      {plan.tokensUsedPercent >= 80 && plan.maxTokensMonthly !== null && (
                        <span className="text-xs text-yellow-500 font-medium">
                          {plan.tokensUsedPercent.toFixed(0)}% usado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Token Alert if near limit */}
                  {plan.maxTokensMonthly !== null && plan.tokensUsedPercent >= 80 && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Zap className="w-4 h-4 text-yellow-500 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-yellow-600">
                            {plan.tokensUsedPercent >= 100 
                              ? 'Limite de tokens atingido' 
                              : 'Tokens acabando'
                            }
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {plan.tokensUsedPercent >= 100 
                              ? 'Faça upgrade para continuar analisando'
                              : 'Considere usar profundidade menor para economizar tokens'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Spending Alert */}
            <SpendingAlert className="animate-slide-up" />

            {/* Stats Grid */}
            <div className="grid md:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: "0.05s" }}>
              {isLoading ? (
                <>
                  <StatsCardSkeleton />
                  <StatsCardSkeleton />
                  <StatsCardSkeleton />
                  <StatsCardSkeleton />
                </>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-4 bg-card border border-border rounded-xl hover-lift cursor-help">
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
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total de repositórios analisados</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-4 bg-card border border-border rounded-xl hover-lift cursor-help">
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
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Análises finalizadas com sucesso</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-4 bg-card border border-border rounded-xl hover-lift cursor-help">
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
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Tokens de IA consumidos em análises</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-4 bg-card border border-border rounded-xl hover-lift cursor-help">
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
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Progresso nos itens de ação das análises</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
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
              
              {isLoading ? (
                <div className="space-y-3">
                  <ActivitySkeleton />
                  <ActivitySkeleton />
                  <ActivitySkeleton />
                </div>
              ) : recentActivities.length === 0 ? (
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
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Meus Projetos</h2>
              {projects.length > 0 && (
                <span className="text-sm text-muted-foreground">{filteredAndSortedProjects.length} de {projects.length} projeto(s)</span>
              )}
            </div>

            {/* Search, Filter, and Sort Controls */}
            {projects.length > 0 && (
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou URL..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filter Tabs and Sort */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <TabsList className="bg-muted/50">
                      <TabsTrigger value="all" className="gap-1.5">
                        Todos
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">{statusCounts.all}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="gap-1.5">
                        Concluídos
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">{statusCounts.completed}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="in-progress" className="gap-1.5">
                        Em Andamento
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">{statusCounts.inProgress}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="error" className="gap-1.5">
                        Erro
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">{statusCounts.error}</Badge>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                    <SelectTrigger className="w-[180px]">
                      <ArrowUpDown className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-desc">Mais recentes</SelectItem>
                      <SelectItem value="date-asc">Mais antigos</SelectItem>
                      <SelectItem value="name-asc">Nome (A-Z)</SelectItem>
                      <SelectItem value="name-desc">Nome (Z-A)</SelectItem>
                      <SelectItem value="status">Por status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Batch Actions Bar */}
                {selectedProjects.size > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <span className="text-sm font-medium">
                      {selectedProjects.size} selecionado(s)
                    </span>
                    <div className="flex-1" />
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      Limpar seleção
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Excluir
                    </Button>
                  </div>
                )}

                {/* Select All */}
                {filteredAndSortedProjects.length > 0 && selectedProjects.size === 0 && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAllVisible} className="text-xs">
                      Selecionar todos ({filteredAndSortedProjects.length})
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState
              icon={FolderGit2}
              title="Nenhum projeto ainda"
              description="Comece analisando seu primeiro repositório GitHub para obter insights valiosos sobre seu código"
              action={{
                label: "Começar Agora",
                onClick: () => navigate("/")
              }}
            />
          ) : filteredAndSortedProjects.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum projeto encontrado"
              description="Tente ajustar os filtros ou a busca para encontrar seus projetos"
              variant="search"
              action={{
                label: "Limpar filtros",
                onClick: () => { setSearchQuery(""); setStatusFilter("all"); }
              }}
            />
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedProjects.map((project) => {
                  const isPinned = (project as any).is_pinned || false;
                  const isSelected = selectedProjects.has(project.id);
                  
                  return (
                    <div
                      key={project.id}
                      className={`p-4 bg-card border rounded-xl hover:shadow-lg transition-all duration-300 cursor-pointer group relative ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/20'
                      } ${isPinned ? 'ring-1 ring-yellow-500/30' : ''}`}
                    >
                      {/* Checkbox and Pin */}
                      <div className="absolute top-3 left-3 flex items-center gap-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectProject(project.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>

                      <div 
                        className="pl-8"
                        onClick={() => project.analysis_status === "completed" && navigate(`/projeto/${project.id}`)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                                {project.name}
                              </h3>
                              {isPinned && (
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {project.github_url.replace("https://github.com/", "")}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePinProject(project.id, isPinned);
                              }}
                              className={`p-1.5 rounded-md transition-colors ${
                                isPinned 
                                  ? 'text-yellow-500 hover:bg-yellow-500/10' 
                                  : 'text-muted-foreground hover:text-yellow-500 hover:bg-muted opacity-0 group-hover:opacity-100'
                              }`}
                            >
                              <Star className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
                            </button>
                            {project.analysis_status === "completed" && (
                              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                            )}
                          </div>
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
                    </div>
                  );
                })}
              </div>

              {/* Load More Indicator */}
              {hasMore && (
                <div 
                  ref={loadMoreRef}
                  className="flex items-center justify-center py-8"
                >
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Carregando mais projetos...</span>
                  </div>
                </div>
              )}

              {/* Show count */}
              {!hasMore && filteredAndSortedProjects.length > ITEMS_PER_PAGE && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando todos os {filteredAndSortedProjects.length} projetos
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projetos selecionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir {selectedProjects.size} projeto(s). 
              Esta ação não pode ser desfeita e todas as análises associadas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir {selectedProjects.size} projeto(s)
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;