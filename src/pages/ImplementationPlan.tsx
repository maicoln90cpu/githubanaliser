import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { 
  Github, 
  Home, 
  Loader2, 
  ClipboardList,
  Bug,
  Sparkles,
  Shield,
  Layers,
  AlertTriangle,
  Wrench,
  TrendingUp,
  Plus,
  Trash2,
  ChevronRight,
  Grid3X3,
  Zap,
  Search,
  X,
  CheckCircle,
  Circle,
  ListFilter
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface Project {
  id: string;
  name: string;
  github_url: string;
}

interface Analysis {
  type: string;
  created_at: string;
}

interface ImplementationPlan {
  id: string;
  title: string;
  focus_type: string;
  analysis_types: string[];
  tokens_used: number;
  created_at: string;
}

interface ImplementationItem {
  id: string;
  plan_id: string;
  category: string;
  title: string;
  description: string | null;
  source_analysis: string | null;
  is_completed: boolean;
  sort_order: number;
}

const FOCUS_OPTIONS = [
  { value: 'bugs', label: 'Correções e Bugs', icon: Bug, color: 'text-red-500' },
  { value: 'features', label: 'Novas Funcionalidades', icon: Sparkles, color: 'text-yellow-500' },
  { value: 'security', label: 'Segurança', icon: Shield, color: 'text-blue-500' },
  { value: 'complete', label: 'Plano Completo', icon: Layers, color: 'text-purple-500' },
];

const ANALYSIS_TYPE_LABELS: Record<string, string> = {
  prd: 'PRD',
  divulgacao: 'Marketing & Lançamento',
  captacao: 'Pitch para Investidores',
  seguranca: 'Segurança',
  ui_theme: 'UI/Theme',
  ferramentas: 'Ferramentas',
  features: 'Novas Features',
  documentacao: 'Documentação',
  prompts: 'Prompts Otimizados',
  quality: 'Qualidade de Código',
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof AlertTriangle; color: string; bgColor: string }> = {
  critical: { label: 'Crítico', icon: AlertTriangle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  implementation: { label: 'Implementação', icon: Wrench, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  improvement: { label: 'Melhoria', icon: TrendingUp, color: 'text-green-500', bgColor: 'bg-green-500/10' },
};

const ImplementationPlanPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  
  const [project, setProject] = useState<Project | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [plans, setPlans] = useState<ImplementationPlan[]>([]);
  const [selectedPlanItems, setSelectedPlanItems] = useState<ImplementationItem[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Generate dialog state
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([]);
  const [focusType, setFocusType] = useState<string>('complete');
  
  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; planId: string | null }>({ open: false, planId: null });

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    loadData();
  }, [id, user, authLoading]);

  const loadData = async () => {
    try {
      // Load project
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("id, name, github_url")
        .eq("id", id)
        .single();

      if (projectError || !projectData) {
        toast.error("Projeto não encontrado");
        navigate("/dashboard");
        return;
      }
      setProject(projectData);

      // Load available analyses
      const { data: analysesData } = await supabase
        .from("analyses")
        .select("type, created_at")
        .eq("project_id", id);
      
      // Get unique types
      const uniqueTypes = new Map<string, Analysis>();
      (analysesData || []).forEach(a => {
        if (!uniqueTypes.has(a.type)) {
          uniqueTypes.set(a.type, a);
        }
      });
      setAnalyses(Array.from(uniqueTypes.values()));

      // Load existing plans
      const { data: plansData } = await supabase
        .from("implementation_plans")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });
      
      setPlans(plansData || []);

      // Auto-select first plan if available
      if (plansData && plansData.length > 0 && !activePlanId) {
        setActivePlanId(plansData[0].id);
        await loadPlanItems(plansData[0].id);
      }

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar projeto");
    } finally {
      setLoading(false);
    }
  };

  const loadPlanItems = async (planId: string) => {
    const { data: itemsData, error } = await supabase
      .from("implementation_items")
      .select("*")
      .eq("plan_id", planId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Erro ao carregar itens:", error);
      return;
    }
    setSelectedPlanItems(itemsData || []);
  };

  const handleSelectPlan = async (planId: string) => {
    setActivePlanId(planId);
    await loadPlanItems(planId);
  };

  const handleToggleItem = async (itemId: string) => {
    const item = selectedPlanItems.find(i => i.id === itemId);
    if (!item) return;

    const newCompleted = !item.is_completed;
    
    // Optimistic update
    setSelectedPlanItems(prev => prev.map(i => 
      i.id === itemId ? { ...i, is_completed: newCompleted } : i
    ));

    const { error } = await supabase
      .from("implementation_items")
      .update({ 
        is_completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null
      })
      .eq("id", itemId);

    if (error) {
      // Revert on error
      setSelectedPlanItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, is_completed: !newCompleted } : i
      ));
      toast.error("Erro ao atualizar item");
    }
  };

  const estimateTokens = () => {
    // Estimate ~3-5k tokens per analysis type selected
    return selectedAnalyses.length * 4000;
  };

  const handleGeneratePlan = async () => {
    if (selectedAnalyses.length === 0) {
      toast.error("Selecione pelo menos uma análise");
      return;
    }

    setGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-implementation-plan", {
        body: {
          projectId: id,
          analysisTypes: selectedAnalyses,
          focusType,
        }
      });

      if (error) throw error;

      toast.success("Plano de implementação gerado!", {
        description: `${data.plan.items_count} itens extraídos`
      });

      setShowGenerateDialog(false);
      setSelectedAnalyses([]);
      
      // Reload plans and select the new one
      await loadData();
      if (data.plan?.id) {
        setActivePlanId(data.plan.id);
        await loadPlanItems(data.plan.id);
      }

    } catch (error: any) {
      console.error("Erro ao gerar plano:", error);
      toast.error(error.message || "Erro ao gerar plano de implementação");
    } finally {
      setGenerating(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!deleteDialog.planId) return;

    try {
      const { error } = await supabase
        .from("implementation_plans")
        .delete()
        .eq("id", deleteDialog.planId);

      if (error) throw error;

      toast.success("Plano excluído");
      setDeleteDialog({ open: false, planId: null });
      
      if (activePlanId === deleteDialog.planId) {
        setActivePlanId(null);
        setSelectedPlanItems([]);
      }
      
      await loadData();

    } catch (error) {
      console.error("Erro ao excluir plano:", error);
      toast.error("Erro ao excluir plano");
    }
  };

  const getProgress = (items: ImplementationItem[], category?: string) => {
    const filtered = category ? items.filter(i => i.category === category) : items;
    if (filtered.length === 0) return 0;
    const completed = filtered.filter(i => i.is_completed).length;
    return Math.round((completed / filtered.length) * 100);
  };

  // Filter items based on search and status
  const filteredItems = selectedPlanItems.filter(item => {
    // Status filter
    if (statusFilter === 'pending' && item.is_completed) return false;
    if (statusFilter === 'completed' && !item.is_completed) return false;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = item.title.toLowerCase().includes(query);
      const matchesDescription = item.description?.toLowerCase().includes(query) || false;
      const matchesSource = (ANALYSIS_TYPE_LABELS[item.source_analysis || ''] || item.source_analysis || '').toLowerCase().includes(query);
      if (!matchesTitle && !matchesDescription && !matchesSource) return false;
    }
    
    return true;
  });

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ImplementationItem[]>);

  const pendingCount = selectedPlanItems.filter(i => !i.is_completed).length;
  const completedCount = selectedPlanItems.filter(i => i.is_completed).length;

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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/projeto/${id}`)}>
              <Grid3X3 className="w-4 h-4 mr-2" />
              Análises
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Plano de Implementação</h1>
              <p className="text-muted-foreground">{project?.name}</p>
            </div>
          </div>
          <Button onClick={() => setShowGenerateDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Gerar Novo Plano
          </Button>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          {/* Plans Sidebar */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Planos Gerados
            </h3>
            
            {plans.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum plano gerado ainda
                  </p>
                  <Button 
                    variant="link" 
                    className="mt-2"
                    onClick={() => setShowGenerateDialog(true)}
                  >
                    Gerar primeiro plano
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {plans.map(plan => {
                  const isActive = activePlanId === plan.id;
                  const FocusIcon = FOCUS_OPTIONS.find(f => f.value === plan.focus_type)?.icon || Layers;
                  
                  return (
                    <Card 
                      key={plan.id}
                      className={`cursor-pointer transition-all ${
                        isActive ? 'border-primary bg-primary/5' : 'hover:border-border/80'
                      }`}
                      onClick={() => handleSelectPlan(plan.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <FocusIcon className="w-5 h-5 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium text-sm line-clamp-2">{plan.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(plan.created_at).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDialog({ open: true, planId: plan.id });
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                        {isActive && (
                          <div className="mt-3 flex items-center gap-2">
                            <Progress value={getProgress(selectedPlanItems)} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground">
                              {getProgress(selectedPlanItems)}%
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            {!activePlanId ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <ChevronRight className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Selecione um Plano</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Selecione um plano existente na barra lateral ou gere um novo plano de implementação baseado nas análises do projeto.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Progress Overview */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Progresso Geral</CardTitle>
                    <CardDescription>
                      {selectedPlanItems.filter(i => i.is_completed).length} de {selectedPlanItems.length} itens concluídos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Progress value={getProgress(selectedPlanItems)} className="h-3" />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                          const count = groupedItems[key]?.length || 0;
                          const completed = groupedItems[key]?.filter(i => i.is_completed).length || 0;
                          const CategoryIcon = config.icon;
                          
                          return (
                            <div key={key} className={`p-3 rounded-lg ${config.bgColor}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <CategoryIcon className={`w-4 h-4 ${config.color}`} />
                                <span className="font-medium text-sm">{config.label}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {completed}/{count} concluídos
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Filters */}
                <Card>
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Search */}
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar itens..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 pr-9"
                        />
                        {searchQuery && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setSearchQuery('')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      
                      {/* Status Filter */}
                      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
                        <Button
                          variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setStatusFilter('all')}
                          className="gap-1.5"
                        >
                          <ListFilter className="w-3.5 h-3.5" />
                          Todos
                          <Badge variant="outline" className="ml-1 h-5 px-1.5">
                            {selectedPlanItems.length}
                          </Badge>
                        </Button>
                        <Button
                          variant={statusFilter === 'pending' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setStatusFilter('pending')}
                          className="gap-1.5"
                        >
                          <Circle className="w-3.5 h-3.5" />
                          Pendentes
                          <Badge variant="outline" className="ml-1 h-5 px-1.5">
                            {pendingCount}
                          </Badge>
                        </Button>
                        <Button
                          variant={statusFilter === 'completed' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setStatusFilter('completed')}
                          className="gap-1.5"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Concluídos
                          <Badge variant="outline" className="ml-1 h-5 px-1.5">
                            {completedCount}
                          </Badge>
                        </Button>
                      </div>
                    </div>
                    
                    {/* Active filters indicator */}
                    {(searchQuery || statusFilter !== 'all') && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                          Mostrando {filteredItems.length} de {selectedPlanItems.length} itens
                        </span>
                        {(searchQuery || statusFilter !== 'all') && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => {
                              setSearchQuery('');
                              setStatusFilter('all');
                            }}
                          >
                            Limpar filtros
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* No results message */}
                {filteredItems.length === 0 && selectedPlanItems.length > 0 && (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <Search className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">
                        Nenhum item encontrado com os filtros atuais
                      </p>
                      <Button
                        variant="link"
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('all');
                        }}
                      >
                        Limpar filtros
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Items by Category */}
                {['critical', 'implementation', 'improvement'].map(category => {
                  const items = groupedItems[category] || [];
                  if (items.length === 0) return null;
                  
                  const config = CATEGORY_CONFIG[category];
                  const CategoryIcon = config.icon;
                  
                  return (
                    <Card key={category}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CategoryIcon className={`w-5 h-5 ${config.color}`} />
                            <CardTitle className="text-lg">{config.label}</CardTitle>
                            <Badge variant="secondary" className="ml-2">
                              {items.filter(i => i.is_completed).length}/{items.length}
                            </Badge>
                          </div>
                          <Progress 
                            value={getProgress(items)} 
                            className="w-24 h-2" 
                          />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {items.map(item => (
                            <div 
                              key={item.id}
                              className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                                item.is_completed 
                                  ? 'bg-muted/50 border-border/50' 
                                  : 'bg-card border-border hover:border-primary/30'
                              }`}
                            >
                              <Checkbox
                                checked={item.is_completed}
                                onCheckedChange={() => handleToggleItem(item.id)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                                  {item.title}
                                </p>
                                {item.description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {item.description}
                                  </p>
                                )}
                                {item.source_analysis && (
                                  <Badge variant="outline" className="mt-2 text-xs">
                                    {ANALYSIS_TYPE_LABELS[item.source_analysis] || item.source_analysis}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Generate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar Plano de Implementação</DialogTitle>
            <DialogDescription>
              Selecione as análises que serão usadas para extrair os itens acionáveis.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Focus Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Foco do Plano</label>
              <Select value={focusType} onValueChange={setFocusType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOCUS_OPTIONS.map(option => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${option.color}`} />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Analysis Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Análises para Incluir</label>
              {analyses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma análise disponível. Gere análises primeiro.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {analyses.map(analysis => (
                    <label
                      key={analysis.type}
                      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedAnalyses.includes(analysis.type)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-border/80'
                      }`}
                    >
                      <Checkbox
                        checked={selectedAnalyses.includes(analysis.type)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedAnalyses(prev => [...prev, analysis.type]);
                          } else {
                            setSelectedAnalyses(prev => prev.filter(t => t !== analysis.type));
                          }
                        }}
                      />
                      <span className="text-sm">
                        {ANALYSIS_TYPE_LABELS[analysis.type] || analysis.type}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Token Estimation */}
            {selectedAnalyses.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm">Tokens estimados:</span>
                </div>
                <span className="font-medium">~{estimateTokens().toLocaleString()}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleGeneratePlan} 
              disabled={generating || selectedAnalyses.length === 0}
              className="gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <ClipboardList className="w-4 h-4" />
                  Gerar Plano
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, planId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os itens do checklist serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlan} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ImplementationPlanPage;
