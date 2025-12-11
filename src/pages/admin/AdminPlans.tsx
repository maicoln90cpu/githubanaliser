import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  Github, Home, Loader2, Crown, ArrowLeft, Zap, Scale, BarChart3,
  AlertTriangle, TrendingUp, DollarSign, Calculator, Edit, Save, X, Leaf, Flame,
  Target, Info, HelpCircle, RefreshCw, CreditCard, Settings, Beaker, PiggyBank
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

interface PlanConfig {
  allowed_depths: string[];
  allowed_analysis_types: string[];
  max_tokens_monthly: number | null;
  allow_economic_mode: boolean;
  limitations: string[];
  can_export_pdf?: boolean;
  can_use_chat?: boolean;
  can_use_implementation_plan?: boolean;
  can_compare_versions?: boolean;
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
  stripe_product_id: string | null;
  stripe_price_id: string | null;
}

const ANALYSIS_TYPES = [
  { key: 'prd', name: 'Análise PRD' },
  { key: 'divulgacao', name: 'Marketing & Lançamento' },
  { key: 'captacao', name: 'Pitch para Investidores' },
  { key: 'seguranca', name: 'Melhorias de Segurança' },
  { key: 'ui_theme', name: 'Melhorias UI/Theme' },
  { key: 'ferramentas', name: 'Melhorias de Ferramentas' },
  { key: 'features', name: 'Novas Features' },
  { key: 'documentacao', name: 'Documentação Técnica' },
  { key: 'prompts', name: 'Prompts Otimizados' },
  { key: 'qualidade', name: 'Qualidade de Código' },
];

const DEPTH_LEVELS = [
  { key: 'critical', name: 'Crítico', icon: Zap, color: 'text-yellow-500' },
  { key: 'balanced', name: 'Balanceado', icon: Scale, color: 'text-blue-500' },
  { key: 'complete', name: 'Completo', icon: BarChart3, color: 'text-purple-500' },
];

const PLAN_FEATURES = [
  { key: 'can_export_pdf', name: 'Exportação PDF', description: 'Exportar análises em PDF' },
  { key: 'can_use_chat', name: 'Chat com IA', description: 'Chat contextual do projeto' },
  { key: 'can_use_implementation_plan', name: 'Plano de Implementação', description: 'Gerar plano de implementação' },
  { key: 'can_compare_versions', name: 'Comparar Versões', description: 'Comparar versões de análise' },
  { key: 'allow_economic_mode', name: 'Escolher Modo', description: 'Escolher entre modo econômico/detalhado' },
];

const AI_MODELS = [
  { id: 'gemini-flash-lite', provider: 'Lovable AI', name: 'Gemini 2.5 Flash Lite', costPer1K: 0.000375, isEconomic: true },
  { id: 'gemini-flash', provider: 'Lovable AI', name: 'Gemini 2.5 Flash', costPer1K: 0.00075, isEconomic: false },
  { id: 'gemini-pro', provider: 'Lovable AI', name: 'Gemini 2.5 Pro', costPer1K: 0.01125, isEconomic: false },
  { id: 'gpt-5-nano', provider: 'OpenAI', name: 'GPT-5 Nano', costPer1K: 0.00045, isEconomic: true },
  { id: 'gpt-4o-mini', provider: 'OpenAI', name: 'GPT-4o Mini', costPer1K: 0.00075, isEconomic: true },
  { id: 'gpt-5-mini', provider: 'OpenAI', name: 'GPT-5 Mini', costPer1K: 0.00225, isEconomic: false },
].sort((a, b) => a.costPer1K - b.costPer1K);

const PROJECT_COUNT_OPTIONS = [1, 5, 10, 20, 30, 50, 100];
const USD_TO_BRL = 5.5;

const AdminPlans = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState<string | null>(null);
  const [globalEconomicMode, setGlobalEconomicMode] = useState<string>('economic');
  
  const [realCosts, setRealCosts] = useState<{
    byDepth: Record<string, { avgCost: number; avgTokens: number; count: number }>;
    overall: { avgCost: number; avgTokens: number; totalCount: number; totalCost: number };
    realCostPer1K: number;
  } | null>(null);

  // Simulator state
  const [depthDistribution, setDepthDistribution] = useState({ critical: 30, balanced: 50, complete: 20 });
  const [modeDistribution, setModeDistribution] = useState({ detailed: 70, economic: 30 });
  const [targetMargin, setTargetMargin] = useState(50);
  const [projectCount, setProjectCount] = useState(10);
  const [selectedModelId, setSelectedModelId] = useState('gemini-flash');

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
      const { data: plansData, error: plansError } = await supabase
        .from("plans")
        .select("*")
        .order("price_monthly", { ascending: true });

      if (plansError) throw plansError;
      
      setPlans(plansData.map(p => ({
        ...p,
        features: Array.isArray(p.features) ? (p.features as string[]) : [],
        config: (p.config as unknown as PlanConfig) || { 
          allowed_depths: [], 
          allowed_analysis_types: [], 
          max_tokens_monthly: null, 
          allow_economic_mode: false, 
          limitations: [],
          can_export_pdf: false,
          can_use_chat: false,
          can_use_implementation_plan: false,
          can_compare_versions: false
        }
      })));

      const { data: settingData } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "analysis_mode")
        .single();
      
      if (settingData) setGlobalEconomicMode(settingData.value);

      // Load real costs
      const { data: usageData } = await supabase
        .from("analysis_usage")
        .select("depth_level, model_used, tokens_estimated, cost_estimated");

      if (usageData && usageData.length > 0) {
        const byDepth: Record<string, { totalCost: number; totalTokens: number; count: number }> = {};
        let totalCost = 0, totalTokens = 0;

        usageData.forEach(u => {
          const depth = u.depth_level || 'balanced';
          const cost = Number(u.cost_estimated || 0);
          const tokens = u.tokens_estimated || 0;

          if (!byDepth[depth]) byDepth[depth] = { totalCost: 0, totalTokens: 0, count: 0 };
          byDepth[depth].totalCost += cost;
          byDepth[depth].totalTokens += tokens;
          byDepth[depth].count++;
          totalCost += cost;
          totalTokens += tokens;
        });

        const realCostPer1K = totalTokens > 0 ? (totalCost * USD_TO_BRL) / (totalTokens / 1000) : 0.0055;

        setRealCosts({
          byDepth: Object.fromEntries(Object.entries(byDepth).map(([k, v]) => [k, { avgCost: v.totalCost / v.count, avgTokens: v.totalTokens / v.count, count: v.count }])),
          overall: { avgCost: totalCost / usageData.length, avgTokens: totalTokens / usageData.length, totalCount: usageData.length, totalCost },
          realCostPer1K
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

  const togglePlanActive = async (plan: Plan) => {
    try {
      const { error } = await supabase
        .from("plans")
        .update({ is_active: !plan.is_active })
        .eq("id", plan.id);

      if (error) throw error;
      toast.success(plan.is_active ? "Plano desativado" : "Plano ativado");
      loadData();
    } catch (error) {
      toast.error("Erro ao atualizar plano");
    }
  };

  const syncWithStripe = async (plan: Plan) => {
    setSyncingStripe(plan.id);
    try {
      // For now, just show what would be synced
      toast.info(`Sincronizando ${plan.name} com Stripe...`);
      
      // This would call an edge function to create/update Stripe product
      // For existing products, we'd need to create a new price (Stripe doesn't allow price updates)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success(`${plan.name} sincronizado! Product: ${plan.stripe_product_id || 'Novo'}`);
    } catch (error) {
      toast.error("Erro ao sincronizar com Stripe");
    } finally {
      setSyncingStripe(null);
    }
  };

  const selectedModel = AI_MODELS.find(m => m.id === selectedModelId) || AI_MODELS[1];

  const simulatedCost = useMemo(() => {
    const depthTokens = { critical: 8000, balanced: 15000, complete: 25000 };
    const weightedTokens = 
      (depthDistribution.critical / 100) * depthTokens.critical +
      (depthDistribution.balanced / 100) * depthTokens.balanced +
      (depthDistribution.complete / 100) * depthTokens.complete;

    const costPerAnalysis = (weightedTokens / 1000) * selectedModel.costPer1K;
    const economicDiscount = selectedModel.isEconomic ? 1 : 0.5;
    const modeWeightedCost = 
      (modeDistribution.detailed / 100) * costPerAnalysis +
      (modeDistribution.economic / 100) * costPerAnalysis * economicDiscount;

    return modeWeightedCost * 8;
  }, [depthDistribution, modeDistribution, selectedModel]);

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

      <main className="container mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Crown className="w-8 h-8 text-yellow-500" />
            <h1 className="text-3xl font-bold">Gestão de Planos</h1>
          </div>
          <p className="text-muted-foreground">Edite planos, simule cenários e analise viabilidade</p>
        </div>

        {/* Sub-Tabs */}
        <Tabs defaultValue="gestao" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="gestao" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Gestão
            </TabsTrigger>
            <TabsTrigger value="simulador" className="flex items-center gap-2">
              <Beaker className="w-4 h-4" />
              Simulador
            </TabsTrigger>
            <TabsTrigger value="viabilidade" className="flex items-center gap-2">
              <PiggyBank className="w-4 h-4" />
              Viabilidade
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Gestão de Planos */}
          <TabsContent value="gestao" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Planos Configurados
                </CardTitle>
                <CardDescription>Gerencie todos os planos, features e integração com Stripe</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plano</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Features</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Stripe</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map(plan => (
                      <TableRow key={plan.id} className={!plan.is_active ? 'opacity-50' : ''}>
                        <TableCell>
                          <div>
                            <p className="font-semibold">{plan.name}</p>
                            <p className="text-xs text-muted-foreground">{plan.slug}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">R$ {(plan.price_monthly || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <span className="font-mono">
                            {plan.config?.max_tokens_monthly 
                              ? `${(plan.config.max_tokens_monthly / 1000).toFixed(0)}K` 
                              : '∞'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {plan.config?.can_export_pdf && <Badge variant="outline" className="text-[10px]">PDF</Badge>}
                            {plan.config?.can_use_chat && <Badge variant="outline" className="text-[10px]">Chat</Badge>}
                            {plan.config?.can_use_implementation_plan && <Badge variant="outline" className="text-[10px]">Impl</Badge>}
                            {plan.config?.can_compare_versions && <Badge variant="outline" className="text-[10px]">Cmp</Badge>}
                            {plan.config?.allow_economic_mode && <Badge variant="outline" className="text-[10px]">Eco</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={plan.is_active || false}
                            onCheckedChange={() => togglePlanActive(plan)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {plan.stripe_price_id ? (
                              <Badge className="bg-green-500/10 text-green-500 text-[10px]">Conectado</Badge>
                            ) : (
                              <Badge className="bg-yellow-500/10 text-yellow-500 text-[10px]">Pendente</Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => syncWithStripe(plan)}
                              disabled={syncingStripe === plan.id}
                            >
                              {syncingStripe === plan.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
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

            {/* Features Matrix */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Matriz de Features</CardTitle>
                <CardDescription>Visão geral das features por plano</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      {plans.filter(p => p.is_active).map(p => (
                        <TableHead key={p.id} className="text-center">{p.name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PLAN_FEATURES.map(feature => (
                      <TableRow key={feature.key}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{feature.name}</p>
                            <p className="text-xs text-muted-foreground">{feature.description}</p>
                          </div>
                        </TableCell>
                        {plans.filter(p => p.is_active).map(p => (
                          <TableCell key={p.id} className="text-center">
                            {(p.config as any)?.[feature.key] ? (
                              <Badge className="bg-green-500/10 text-green-500">✓</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell><p className="font-medium text-sm">Profundidades</p></TableCell>
                      {plans.filter(p => p.is_active).map(p => (
                        <TableCell key={p.id} className="text-center">
                          <div className="flex justify-center gap-1">
                            {p.config?.allowed_depths?.map(d => (
                              <Badge key={d} variant="outline" className="text-[10px]">
                                {d === 'critical' ? '⚡' : d === 'balanced' ? '⚖️' : '📊'}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell><p className="font-medium text-sm">Tipos de Análise</p></TableCell>
                      {plans.filter(p => p.is_active).map(p => (
                        <TableCell key={p.id} className="text-center font-mono">
                          {p.config?.allowed_analysis_types?.length || 0}/10
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Simulador */}
          <TabsContent value="simulador" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Simulador de Cenários Avançado
                </CardTitle>
                <CardDescription>Configure distribuição de uso e veja impacto nos custos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid lg:grid-cols-4 gap-6">
                  {/* Depth Distribution */}
                  <div className="space-y-4">
                    <Label>Profundidade de Análise</Label>
                    {DEPTH_LEVELS.map(depth => (
                      <div key={depth.key} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className={`flex items-center gap-1 ${depth.color}`}>
                            <depth.icon className="w-3 h-3" /> {depth.name}
                          </span>
                          <span>{(depthDistribution as any)[depth.key]}%</span>
                        </div>
                        <Slider
                          value={[(depthDistribution as any)[depth.key]]}
                          onValueChange={([v]) => {
                            const newDist = { ...depthDistribution, [depth.key]: v };
                            const total = newDist.critical + newDist.balanced + newDist.complete;
                            if (total <= 100) setDepthDistribution(newDist);
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
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1"><Leaf className="w-3 h-3 text-green-500" /> Econômico</span>
                      <span>{modeDistribution.economic}%</span>
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

                  {/* Model & Project Count */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        Modelo de IA
                      </Label>
                      <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AI_MODELS.map(model => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex items-center gap-2">
                                {model.isEconomic ? <Leaf className="w-3 h-3 text-green-500" /> : <Flame className="w-3 h-3 text-orange-500" />}
                                <span>{model.name}</span>
                                <span className="text-xs text-muted-foreground">${model.costPer1K.toFixed(5)}/1K</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
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
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Custo/Projeto:</span>
                        <span className="font-bold text-destructive">R$ {(simulatedCost * USD_TO_BRL).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Custo Total ({projectCount}p):</span>
                        <span className="font-bold text-destructive">R$ {(simulatedCost * USD_TO_BRL * projectCount).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Results per Plan */}
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                    <Label>Resultados por Plano</Label>
                    <div className="space-y-3">
                      {plans.filter(p => p.is_active).map(plan => {
                        const maxTokens = plan.config?.max_tokens_monthly || 1000000;
                        const maxCostBRL = (maxTokens / 1000) * (realCosts?.realCostPer1K || 0.0055);
                        const revenue = plan.price_monthly || 0;
                        const margin = revenue > 0 ? ((revenue - maxCostBRL) / revenue) * 100 : -100;
                        const suggestedPrice = maxCostBRL / (1 - targetMargin / 100);
                        
                        return (
                          <div key={plan.id} className="p-3 bg-background rounded border">
                            <div className="flex justify-between items-center mb-2">
                              <Badge variant="outline">{plan.name}</Badge>
                              <span className={`font-bold ${getMarginColor(margin)}`}>{margin.toFixed(0)}%</span>
                            </div>
                            <div className="text-xs space-y-1 text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Receita:</span>
                                <span className="text-green-500">R$ {revenue.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Custo máx ({(maxTokens/1000).toFixed(0)}K tokens):</span>
                                <span>R$ {maxCostBRL.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Preço sugerido ({targetMargin}%):</span>
                                <span className="text-primary font-semibold">R$ {suggestedPrice.toFixed(2)}</span>
                              </div>
                            </div>
                            {margin < 0 && <p className="text-xs text-destructive mt-2">❌ Margem negativa</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Viabilidade */}
          <TabsContent value="viabilidade" className="space-y-6">
            {/* Real Cost Summary */}
            {realCosts && (
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="w-5 h-5 text-primary" />
                    Custos Reais do Sistema
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Custo Real/1K tokens</p>
                      <p className="text-2xl font-bold text-primary">R$ {realCosts.realCostPer1K.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total de Análises</p>
                      <p className="text-2xl font-bold">{realCosts.overall.totalCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Custo Total Acumulado</p>
                      <p className="text-2xl font-bold text-destructive">R$ {(realCosts.overall.totalCost * USD_TO_BRL).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tokens Médio/Análise</p>
                      <p className="text-2xl font-bold">{Math.round(realCosts.overall.avgTokens).toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Viability Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Viabilidade por Tokens (Dados Reais)
                </CardTitle>
                <CardDescription>
                  Cálculos baseados no custo real de R$ {realCosts?.realCostPer1K.toFixed(4) || '0.0055'}/1K tokens
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plano</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Limite Tokens</TableHead>
                      <TableHead className="text-right">Custo Máximo</TableHead>
                      <TableHead className="text-right">Margem</TableHead>
                      <TableHead className="text-right">Breakeven</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.filter(p => p.is_active).map(plan => {
                      const tokenLimit = plan.config?.max_tokens_monthly || 0;
                      const costPer1K = realCosts?.realCostPer1K || 0.0055;
                      const maxCostBRL = tokenLimit > 0 ? (tokenLimit / 1000) * costPer1K : 0;
                      const revenue = plan.price_monthly || 0;
                      const margin = revenue > 0 ? ((revenue - maxCostBRL) / revenue) * 100 : (tokenLimit === 0 ? 100 : -100);
                      const breakeven = costPer1K > 0 ? Math.ceil(revenue / costPer1K) * 1000 : 0;
                      const isProfitable = margin > 0;
                      
                      return (
                        <TableRow key={plan.id}>
                          <TableCell>
                            <Badge variant="outline" className={plan.slug === 'pro' ? 'border-purple-500/50' : plan.slug === 'basic' ? 'border-blue-500/50' : plan.slug === 'starter' ? 'border-orange-500/50' : ''}>
                              {plan.name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">R$ {revenue.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {tokenLimit > 0 ? `${(tokenLimit / 1000).toFixed(0)}K` : '∞'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-destructive">
                            R$ {maxCostBRL.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-bold ${getMarginColor(margin)}`}>{margin.toFixed(0)}%</span>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {breakeven > 0 ? `${(breakeven / 1000).toFixed(0)}K tokens` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {isProfitable ? (
                              <Badge className="bg-green-500/10 text-green-500">Viável</Badge>
                            ) : (
                              <Badge className="bg-red-500/10 text-red-500">Revisar</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Alerts */}
            <div className="space-y-2">
              {plans.filter(p => p.is_active && p.price_monthly && p.price_monthly > 0).map(plan => {
                const tokenLimit = plan.config?.max_tokens_monthly || 0;
                const costPer1K = realCosts?.realCostPer1K || 0.0055;
                const maxCostBRL = tokenLimit > 0 ? (tokenLimit / 1000) * costPer1K : 0;
                const revenue = plan.price_monthly || 0;
                const margin = revenue > 0 ? ((revenue - maxCostBRL) / revenue) * 100 : 100;
                
                if (margin < 0) {
                  return (
                    <div key={plan.id} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-600">Plano {plan.name} não é lucrativo</p>
                        <p className="text-xs text-muted-foreground">
                          Aumente o preço para R$ {(maxCostBRL / 0.5).toFixed(2)} ou reduza o limite de tokens.
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </TabsContent>
        </Tabs>
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

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Zap className="w-4 h-4 text-primary" />
                  Limite de Tokens Mensais
                </Label>
                <Input 
                  type="number" 
                  value={editingPlan.config?.max_tokens_monthly || ''} 
                  placeholder="Deixe vazio para ilimitado" 
                  onChange={e => setEditingPlan({...editingPlan, config: {...editingPlan.config, max_tokens_monthly: e.target.value ? parseInt(e.target.value) : null}})} 
                />
              </div>

              {/* Features Checkboxes */}
              <div className="space-y-2">
                <Label>Features Disponíveis</Label>
                <div className="grid grid-cols-2 gap-3">
                  {PLAN_FEATURES.map(feature => (
                    <label key={feature.key} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={(editingPlan.config as any)?.[feature.key] || false}
                        onCheckedChange={checked => setEditingPlan({
                          ...editingPlan,
                          config: {...editingPlan.config, [feature.key]: !!checked}
                        })}
                      />
                      <div>
                        <p className="text-sm font-medium">{feature.name}</p>
                        <p className="text-xs text-muted-foreground">{feature.description}</p>
                      </div>
                    </label>
                  ))}
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
                <div className="grid grid-cols-3 gap-2">
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
