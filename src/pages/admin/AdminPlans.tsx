import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
  Github, Home, Loader2, Crown, Check, ArrowLeft, Zap, Scale, BarChart3,
  AlertTriangle, TrendingUp, DollarSign, Calculator, Edit, Save, X, Plus, Trash2, Leaf, Flame,
  Target, Info, HelpCircle, Percent
} from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/useAdmin";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PlanConfig {
  allowed_depths: string[];
  allowed_analysis_types: string[];
  max_tokens_monthly: number | null;
  allow_economic_mode: boolean;
  limitations: string[];
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_analyses: number | null;
  daily_analyses: number | null;
  price_monthly: number | null;
  features: string[];
  is_active: boolean | null;
  config: PlanConfig;
}

const ANALYSIS_TYPES = [
  { key: 'prd', name: 'PRD' },
  { key: 'divulgacao', name: 'Divulgação' },
  { key: 'captacao', name: 'Captação' },
  { key: 'seguranca', name: 'Segurança' },
  { key: 'ui_theme', name: 'UI/Theme' },
  { key: 'ferramentas', name: 'Ferramentas' },
  { key: 'features', name: 'Features' },
  { key: 'documentacao', name: 'Documentação' },
];

const DEPTH_LEVELS = [
  { key: 'critical', name: 'Crítico', icon: Zap, color: 'text-yellow-500' },
  { key: 'balanced', name: 'Balanceado', icon: Scale, color: 'text-blue-500' },
  { key: 'complete', name: 'Completo', icon: BarChart3, color: 'text-purple-500' },
];

const PROJECT_COUNT_OPTIONS = [1, 5, 10, 20, 30, 50, 100];
const USD_TO_BRL = 5.0;

const AdminPlans = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [globalEconomicMode, setGlobalEconomicMode] = useState<string>('economic');
  
  // Real cost data from database
  const [realCosts, setRealCosts] = useState<{
    byDepth: Record<string, { avgCost: number; avgTokens: number; count: number }>;
    byModel: Record<string, { avgCost: number; avgTokens: number; count: number }>;
    overall: { avgCost: number; avgTokens: number; totalCount: number; totalCost: number };
  } | null>(null);

  // Simulator state
  const [depthDistribution, setDepthDistribution] = useState({ critical: 30, balanced: 50, complete: 20 });
  const [modeDistribution, setModeDistribution] = useState({ detailed: 70, economic: 30 });
  const [targetMargin, setTargetMargin] = useState(50);
  const [projectCount, setProjectCount] = useState(10);

  useEffect(() => {
    if (adminLoading) return;
    if (!isAdmin) {
      toast.error("Acesso negado.");
      navigate("/dashboard");
      return;
    }
    loadData();
  }, [isAdmin, adminLoading, navigate]);

  const loadData = async () => {
    try {
      // Load plans
      const { data: plansData, error: plansError } = await supabase
        .from("plans")
        .select("*")
        .order("price_monthly", { ascending: true });

      if (plansError) throw plansError;
      
      setPlans(plansData.map(p => ({
        ...p,
        features: Array.isArray(p.features) ? (p.features as string[]) : [],
        config: (p.config as unknown as PlanConfig) || { allowed_depths: [], allowed_analysis_types: [], max_tokens_monthly: null, allow_economic_mode: false, limitations: [] }
      })));

      // Load global economic mode setting
      const { data: settingData } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "analysis_mode")
        .single();
      
      if (settingData) {
        setGlobalEconomicMode(settingData.value);
      }

      // Load real costs from analysis_usage
      const { data: usageData } = await supabase
        .from("analysis_usage")
        .select("depth_level, model_used, tokens_estimated, cost_estimated");

      if (usageData && usageData.length > 0) {
        const byDepth: Record<string, { totalCost: number; totalTokens: number; count: number }> = {};
        const byModel: Record<string, { totalCost: number; totalTokens: number; count: number }> = {};
        let totalCost = 0, totalTokens = 0;

        usageData.forEach(u => {
          const depth = u.depth_level || 'balanced';
          const model = u.model_used || 'unknown';
          const cost = u.cost_estimated || 0;
          const tokens = u.tokens_estimated || 0;

          if (!byDepth[depth]) byDepth[depth] = { totalCost: 0, totalTokens: 0, count: 0 };
          byDepth[depth].totalCost += cost;
          byDepth[depth].totalTokens += tokens;
          byDepth[depth].count++;

          if (!byModel[model]) byModel[model] = { totalCost: 0, totalTokens: 0, count: 0 };
          byModel[model].totalCost += cost;
          byModel[model].totalTokens += tokens;
          byModel[model].count++;

          totalCost += cost;
          totalTokens += tokens;
        });

        setRealCosts({
          byDepth: Object.fromEntries(Object.entries(byDepth).map(([k, v]) => [k, { avgCost: v.totalCost / v.count, avgTokens: v.totalTokens / v.count, count: v.count }])),
          byModel: Object.fromEntries(Object.entries(byModel).map(([k, v]) => [k, { avgCost: v.totalCost / v.count, avgTokens: v.totalTokens / v.count, count: v.count }])),
          overall: { avgCost: totalCost / usageData.length, avgTokens: totalTokens / usageData.length, totalCount: usageData.length, totalCost }
        });
      }
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const savePlan = async () => {
    if (!editingPlan) return;
    try {
      const configJson = JSON.parse(JSON.stringify(editingPlan.config));
      
      const { error } = await supabase
        .from("plans")
        .update({
          name: editingPlan.name,
          description: editingPlan.description,
          monthly_analyses: editingPlan.monthly_analyses,
          daily_analyses: editingPlan.daily_analyses,
          price_monthly: editingPlan.price_monthly,
          features: editingPlan.features,
          config: configJson,
          is_active: editingPlan.is_active
        })
        .eq("id", editingPlan.id);

      if (error) throw error;
      toast.success("Plano atualizado!");
      setEditDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao salvar plano");
    }
  };

  // Get model-specific data
  const detailedModel = realCosts?.byModel['google/gemini-2.5-flash'];
  const economicModel = realCosts?.byModel['google/gemini-2.5-flash-lite'];

  // Tokens per project by model
  const tokensPerProjectDetailed = (detailedModel?.avgTokens || 2250) * 8; // 8 analysis types
  const tokensPerProjectEconomic = (economicModel?.avgTokens || 1600) * 8;

  // Calculate weighted average cost based on simulator settings
  const simulatedCost = useMemo(() => {
    if (!realCosts) return null;
    
    const depthCosts = {
      critical: realCosts.byDepth['critical']?.avgCost || 0.0044,
      balanced: realCosts.byDepth['balanced']?.avgCost || 0.0088,
      complete: realCosts.byDepth['complete']?.avgCost || 0.022,
    };

    // Weighted by depth
    const depthWeightedCost = 
      (depthDistribution.critical / 100) * depthCosts.critical +
      (depthDistribution.balanced / 100) * depthCosts.balanced +
      (depthDistribution.complete / 100) * depthCosts.complete;

    // Economic mode uses Flash Lite (~30% cheaper)
    const economicDiscount = 0.7;
    const modeWeightedCost = 
      (modeDistribution.detailed / 100) * depthWeightedCost +
      (modeDistribution.economic / 100) * depthWeightedCost * economicDiscount;

    return modeWeightedCost * 8; // 8 analysis types per project
  }, [realCosts, depthDistribution, modeDistribution]);

  // Tokens per project based on mode distribution
  const simulatedTokensPerProject = useMemo(() => {
    return (
      (modeDistribution.detailed / 100) * tokensPerProjectDetailed +
      (modeDistribution.economic / 100) * tokensPerProjectEconomic
    );
  }, [modeDistribution, tokensPerProjectDetailed, tokensPerProjectEconomic]);

  const getMarginColor = (margin: number) => {
    if (margin >= 50) return 'text-green-500';
    if (margin >= 20) return 'text-yellow-500';
    if (margin >= 0) return 'text-orange-500';
    return 'text-destructive';
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate totals for executive summary
  const totalRevenuePotential = plans.reduce((sum, p) => sum + (p.price_monthly || 0), 0);
  const avgSystemMargin = plans.length > 0 
    ? plans.reduce((sum, p) => {
        const maxCost = ((simulatedCost || 0) * USD_TO_BRL) * (p.monthly_analyses || 0);
        const revenue = p.price_monthly || 0;
        return sum + (revenue > 0 ? ((revenue - maxCost) / revenue) * 100 : 0);
      }, 0) / plans.filter(p => (p.price_monthly || 0) > 0).length
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <Github className="w-6 h-6 text-foreground" />
            <span className="font-semibold text-xl">GitAnalyzer</span>
            <Badge variant="destructive" className="text-xs">Admin</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Title */}
        <div className="flex items-center gap-3">
          <Crown className="w-8 h-8 text-yellow-500" />
          <div>
            <h1 className="text-3xl font-bold">Gestão de Planos</h1>
            <p className="text-muted-foreground">Edite planos, simule cenários e analise viabilidade</p>
          </div>
        </div>

        {/* Executive Summary */}
        {realCosts && (
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="w-5 h-5 text-primary" />
                Resumo Executivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total de Análises</p>
                  <p className="text-2xl font-bold">{realCosts.overall.totalCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Custo Total Acumulado</p>
                  <p className="text-2xl font-bold text-destructive">R$ {(realCosts.overall.totalCost * USD_TO_BRL).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Custo Médio/Análise</p>
                  <p className="text-2xl font-bold">R$ {(realCosts.overall.avgCost * USD_TO_BRL).toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tokens Médio/Análise</p>
                  <p className="text-2xl font-bold">{Math.round(realCosts.overall.avgTokens).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margem Média Sistema</p>
                  <p className={`text-2xl font-bold ${getMarginColor(avgSystemMargin)}`}>{avgSystemMargin.toFixed(0)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cost Cards by Model and Depth */}
        {realCosts && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Custos Reais por Categoria
            </h2>
            
            {/* By Model */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-orange-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    Modo Detalhado (Gemini Flash)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-orange-500">
                    R$ {((detailedModel?.avgCost || 0.00227) * USD_TO_BRL).toFixed(4)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {detailedModel?.count || 0} análises • ~{Math.round(detailedModel?.avgTokens || 2250)} tokens/análise
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ~{Math.round(tokensPerProjectDetailed).toLocaleString()} tokens/projeto
                  </p>
                </CardContent>
              </Card>
              <Card className="border-green-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Leaf className="w-4 h-4 text-green-500" />
                    Modo Econômico (Gemini Flash Lite)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-500">
                    R$ {((economicModel?.avgCost || 0.0016) * USD_TO_BRL).toFixed(4)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {economicModel?.count || 0} análises • ~{Math.round(economicModel?.avgTokens || 1600)} tokens/análise
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ~{Math.round(tokensPerProjectEconomic).toLocaleString()} tokens/projeto
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* By Depth */}
            <div className="grid md:grid-cols-4 gap-4">
              {DEPTH_LEVELS.map(depth => {
                const data = realCosts.byDepth[depth.key];
                return (
                  <Card key={depth.key}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <depth.icon className={`w-4 h-4 ${depth.color}`} />
                        {depth.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-bold ${depth.color}`}>
                        R$ {((data?.avgCost || 0) * USD_TO_BRL).toFixed(4)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {data?.count || 0} análises • ~{Math.round(data?.avgTokens || 0)} tokens
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Média Geral
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">
                    R$ {(realCosts.overall.avgCost * USD_TO_BRL).toFixed(4)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {realCosts.overall.totalCount} total
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Simulator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Simulador de Cenários Avançado
            </CardTitle>
            <CardDescription>
              Simule diferentes cenários de uso e calcule custos e margens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-4 gap-6">
              {/* Depth Distribution */}
              <div className="space-y-4">
                <Label>Distribuição de Profundidade</Label>
                {['critical', 'balanced', 'complete'].map(depth => (
                  <div key={depth} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{depth === 'critical' ? '⚡ Crítico' : depth === 'balanced' ? '⚖️ Balanceado' : '📊 Completo'}</span>
                      <span>{depthDistribution[depth as keyof typeof depthDistribution]}%</span>
                    </div>
                    <Slider
                      value={[depthDistribution[depth as keyof typeof depthDistribution]]}
                      onValueChange={([v]) => {
                        const remaining = 100 - v;
                        const others = Object.keys(depthDistribution).filter(k => k !== depth);
                        const otherSum = others.reduce((sum, k) => sum + depthDistribution[k as keyof typeof depthDistribution], 0);
                        if (otherSum > 0) {
                          setDepthDistribution(prev => ({
                            ...prev,
                            [depth]: v,
                            [others[0]]: Math.round((prev[others[0] as keyof typeof prev] / otherSum) * remaining),
                            [others[1]]: remaining - Math.round((prev[others[0] as keyof typeof prev] / otherSum) * remaining),
                          }));
                        }
                      }}
                      max={100}
                      step={5}
                    />
                  </div>
                ))}
              </div>

              {/* Mode Distribution */}
              <div className="space-y-4">
                <Label>Modo de Análise</Label>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> Detalhado</span>
                    <span>{modeDistribution.detailed}%</span>
                  </div>
                  <Slider
                    value={[modeDistribution.detailed]}
                    onValueChange={([v]) => setModeDistribution({ detailed: v, economic: 100 - v })}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1"><Leaf className="w-3 h-3 text-green-500" /> Econômico</span>
                    <span>{modeDistribution.economic}%</span>
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  <Label>Margem Alvo</Label>
                  <div className="flex justify-between text-sm">
                    <span>Meta de lucro</span>
                    <span className={getMarginColor(targetMargin)}>{targetMargin}%</span>
                  </div>
                  <Slider
                    value={[targetMargin]}
                    onValueChange={([v]) => setTargetMargin(v)}
                    max={80}
                    min={10}
                    step={5}
                  />
                </div>
              </div>

              {/* Project Count */}
              <div className="space-y-4">
                <Label>Quantidade de Projetos</Label>
                <Select value={projectCount.toString()} onValueChange={v => setProjectCount(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_COUNT_OPTIONS.map(count => (
                      <SelectItem key={count} value={count.toString()}>
                        {count} {count === 1 ? 'projeto' : 'projetos'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="p-3 bg-muted/50 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Custo Total:</span>
                    <span className="font-bold text-destructive">
                      R$ {(((simulatedCost || 0) * USD_TO_BRL) * projectCount).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tokens Total:</span>
                    <span className="font-bold">
                      {Math.round(simulatedTokensPerProject * projectCount).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                <Label>Resultados Simulados</Label>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Custo/Projeto:</span>
                    <span className="font-mono font-semibold">R$ {((simulatedCost || 0) * USD_TO_BRL).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tokens/Projeto:</span>
                    <span className="font-mono font-semibold">{Math.round(simulatedTokensPerProject).toLocaleString()}</span>
                  </div>
                  <hr className="border-border" />
                  {plans.map(plan => {
                    const maxCost = ((simulatedCost || 0) * USD_TO_BRL) * (plan.monthly_analyses || 0);
                    const revenue = plan.price_monthly || 0;
                    const margin = revenue > 0 ? ((revenue - maxCost) / revenue) * 100 : -100;
                    const suggestedPrice = maxCost / (1 - targetMargin / 100);
                    const breakeven = revenue > 0 ? Math.ceil(revenue / (((simulatedCost || 0) * USD_TO_BRL))) : 0;
                    
                    return (
                      <div key={plan.id} className="p-3 bg-background rounded border">
                        <div className="flex justify-between items-center mb-2">
                          <Badge variant="outline">{plan.name}</Badge>
                          <span className={`font-bold ${getMarginColor(margin)}`}>{margin.toFixed(0)}%</span>
                        </div>
                        <div className="text-xs space-y-1 text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Custo máx ({plan.monthly_analyses} proj):</span>
                            <span>R$ {maxCost.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Breakeven:</span>
                            <span className="text-primary">{breakeven} projetos</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Preço sugerido ({targetMargin}%):</span>
                            <span className="text-primary font-semibold">R$ {suggestedPrice.toFixed(2)}</span>
                          </div>
                        </div>
                        {margin < targetMargin && margin >= 0 && (
                          <p className="text-xs text-yellow-500 mt-2">⚠️ Abaixo da margem alvo</p>
                        )}
                        {margin < 0 && (
                          <p className="text-xs text-destructive mt-2">❌ Margem negativa</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Token Viability */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Viabilidade por Tokens
            </CardTitle>
            <CardDescription>
              Análise de consumo de tokens por modelo e projeções de custo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Limite Projetos</TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Flame className="w-3 h-3 text-orange-500" />
                      Tokens/Proj (Detalhado)
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Leaf className="w-3 h-3 text-green-500" />
                      Tokens/Proj (Econômico)
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Tokens Simulados/Proj</TableHead>
                  <TableHead className="text-right">Limite Tokens</TableHead>
                  <TableHead className="text-right">Custo Estimado</TableHead>
                  <TableHead className="text-right">Recomendação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map(plan => {
                  const estimatedTokens = simulatedTokensPerProject * (plan.monthly_analyses || 0);
                  const tokenLimit = plan.config?.max_tokens_monthly;
                  const costPerToken = 0.000001;
                  const estimatedCost = (tokenLimit || estimatedTokens) * costPerToken * USD_TO_BRL;
                  
                  return (
                    <TableRow key={plan.id}>
                      <TableCell><Badge variant="outline">{plan.name}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{plan.monthly_analyses}</TableCell>
                      <TableCell className="text-right font-mono text-orange-500">
                        ~{Math.round(tokensPerProjectDetailed).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-500">
                        ~{Math.round(tokensPerProjectEconomic).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ~{Math.round(simulatedTokensPerProject).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {tokenLimit ? tokenLimit.toLocaleString() : '∞'}
                      </TableCell>
                      <TableCell className="text-right font-mono">R$ {estimatedCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {!tokenLimit ? (
                          <Badge className="bg-yellow-500/10 text-yellow-500">Definir limite</Badge>
                        ) : tokenLimit < estimatedTokens ? (
                          <Badge className="bg-green-500/10 text-green-500">Protegido</Badge>
                        ) : (
                          <Badge className="bg-blue-500/10 text-blue-500">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Plans Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Planos Configurados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Limites</TableHead>
                  <TableHead>Profundidades</TableHead>
                  <TableHead>Análises</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map(plan => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{plan.name}</p>
                        <p className="text-xs text-muted-foreground">{plan.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">R$ {(plan.price_monthly || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-sm">
                      {plan.monthly_analyses}/mês • {plan.daily_analyses}/dia
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {plan.config?.allowed_depths?.map(d => (
                          <Badge key={d} variant="outline" className="text-xs">
                            {d === 'critical' ? '⚡' : d === 'balanced' ? '⚖️' : '📊'}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {plan.config?.allowed_analysis_types?.length || 0}/8
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPlan(plan);
                          setEditDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Plano: {editingPlan?.name}</DialogTitle>
            <DialogDescription>Configure todos os parâmetros do plano</DialogDescription>
          </DialogHeader>
          
          {editingPlan && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={editingPlan.name} onChange={e => setEditingPlan({...editingPlan, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Preço (R$/mês)</Label>
                  <Input type="number" step="0.01" value={editingPlan.price_monthly || 0} onChange={e => setEditingPlan({...editingPlan, price_monthly: parseFloat(e.target.value)})} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={editingPlan.description || ''} onChange={e => setEditingPlan({...editingPlan, description: e.target.value})} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Limite Mensal</Label>
                  <Input type="number" value={editingPlan.monthly_analyses || 0} onChange={e => setEditingPlan({...editingPlan, monthly_analyses: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Limite Diário</Label>
                  <Input type="number" value={editingPlan.daily_analyses || 0} onChange={e => setEditingPlan({...editingPlan, daily_analyses: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Tokens/Mês</Label>
                  <Input type="number" value={editingPlan.config?.max_tokens_monthly || ''} placeholder="∞" onChange={e => setEditingPlan({...editingPlan, config: {...editingPlan.config, max_tokens_monthly: e.target.value ? parseInt(e.target.value) : null}})} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Profundidades Permitidas</Label>
                <div className="flex gap-4">
                  {DEPTH_LEVELS.map(depth => (
                    <label key={depth.key} className="flex items-center gap-2">
                      <Checkbox
                        checked={editingPlan.config?.allowed_depths?.includes(depth.key)}
                        onCheckedChange={checked => {
                          const depths = editingPlan.config?.allowed_depths || [];
                          setEditingPlan({
                            ...editingPlan,
                            config: {
                              ...editingPlan.config,
                              allowed_depths: checked ? [...depths, depth.key] : depths.filter(d => d !== depth.key)
                            }
                          });
                        }}
                      />
                      <span className={depth.color}>{depth.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipos de Análise Permitidos</Label>
                <div className="grid grid-cols-4 gap-2">
                  {ANALYSIS_TYPES.map(type => (
                    <label key={type.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={editingPlan.config?.allowed_analysis_types?.includes(type.key)}
                        onCheckedChange={checked => {
                          const types = editingPlan.config?.allowed_analysis_types || [];
                          setEditingPlan({
                            ...editingPlan,
                            config: {
                              ...editingPlan.config,
                              allowed_analysis_types: checked ? [...types, type.key] : types.filter(t => t !== type.key)
                            }
                          });
                        }}
                      />
                      {type.name}
                    </label>
                  ))}
                </div>
              </div>

              <TooltipProvider>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={editingPlan.config?.allow_economic_mode}
                    onCheckedChange={checked => setEditingPlan({...editingPlan, config: {...editingPlan.config, allow_economic_mode: !!checked}})}
                  />
                  <Label className="flex items-center gap-1">
                    Permitir Usuário Escolher Modo de Análise
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          <strong>Marcado:</strong> Usuário pode alternar entre modo Econômico e Detalhado.<br />
                          <strong>Desmarcado:</strong> Usuário usa sempre o modo padrão global definido em Configurações ({globalEconomicMode === 'economic' ? 'Econômico' : 'Detalhado'}).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                </div>
              </TooltipProvider>

              <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                <p className="flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Modo padrão global atual: <strong className="text-foreground">{globalEconomicMode === 'economic' ? 'Econômico' : 'Detalhado'}</strong>
                  {' '}(configurado em Admin → Configurações)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Features (uma por linha)</Label>
                <Textarea 
                  value={editingPlan.features?.join('\n') || ''} 
                  onChange={e => setEditingPlan({...editingPlan, features: e.target.value.split('\n').filter(f => f.trim())})}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={savePlan}><Save className="w-4 h-4 mr-2" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPlans;
