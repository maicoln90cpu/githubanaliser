import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Github, 
  Home, 
  Loader2, 
  Crown,
  Check,
  ArrowLeft,
  Zap,
  Scale,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Calculator
} from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/useAdmin";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthly_analyses: number;
  daily_analyses: number;
  price_monthly: number;
  features: string[];
  is_active: boolean;
}

// Cost estimates per depth level (USD)
const DEPTH_COSTS = {
  critical: 0.022,
  balanced: 0.044,
  complete: 0.110,
};

// Analysis types with their names
const ANALYSIS_TYPES = [
  { key: 'prd', name: 'Análise PRD' },
  { key: 'divulgacao', name: 'Plano Divulgação' },
  { key: 'captacao', name: 'Plano Captação' },
  { key: 'seguranca', name: 'Segurança' },
  { key: 'ui_theme', name: 'UI/Theme' },
  { key: 'ferramentas', name: 'Ferramentas' },
  { key: 'features', name: 'Features' },
  { key: 'documentacao', name: 'Documentação' },
];

// Plan configurations
const PLAN_CONFIGS = {
  free: {
    name: 'Free',
    price: 0,
    monthlyProjects: 3,
    dailyProjects: 1,
    analysisTypes: ['prd', 'divulgacao', 'captacao'], // 3 types
    allowedDepths: ['critical'],
  },
  basic: {
    name: 'Basic',
    price: 29.90,
    monthlyProjects: 20,
    dailyProjects: 5,
    analysisTypes: ANALYSIS_TYPES.map(a => a.key), // all 8 types
    allowedDepths: ['critical', 'balanced'],
  },
  pro: {
    name: 'Pro',
    price: 79.90,
    monthlyProjects: 100,
    dailyProjects: 15,
    analysisTypes: ANALYSIS_TYPES.map(a => a.key), // all 8 types
    allowedDepths: ['critical', 'balanced', 'complete'],
  },
};

// Distribution scenarios for simulation
const DISTRIBUTION_SCENARIOS = {
  pessimistic: { critical: 0, balanced: 0.3, complete: 0.7 }, // Most expensive
  realistic: { critical: 0.3, balanced: 0.5, complete: 0.2 },
  optimistic: { critical: 0.6, balanced: 0.3, complete: 0.1 }, // Most economic
  economic_mode: { critical: 0.8, balanced: 0.2, complete: 0 },
};

const USD_TO_BRL = 5.0; // Exchange rate

const AdminPlans = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState<keyof typeof DISTRIBUTION_SCENARIOS>('realistic');
  const [economicMode, setEconomicMode] = useState(false);

  useEffect(() => {
    if (adminLoading) return;

    if (!isAdmin) {
      toast.error("Acesso negado. Área restrita para administradores.");
      navigate("/dashboard");
      return;
    }

    const loadPlans = async () => {
      try {
        const { data, error } = await supabase
          .from("plans")
          .select("*")
          .order("price_monthly", { ascending: true });

        if (error) throw error;
        
        setPlans(data.map(p => ({
          ...p,
          features: Array.isArray(p.features) ? (p.features as string[]) : []
        })));

        // Load economic mode setting
        const { data: settings } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "analysis_mode")
          .maybeSingle();
        
        setEconomicMode(settings?.value === 'economic');
      } catch (error) {
        console.error("Erro ao carregar planos:", error);
        toast.error("Erro ao carregar planos");
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, [isAdmin, adminLoading, navigate]);

  // Calculate cost per project based on depth distribution
  const calculateProjectCost = (
    analysisTypes: string[],
    allowedDepths: string[],
    scenario: typeof DISTRIBUTION_SCENARIOS[keyof typeof DISTRIBUTION_SCENARIOS]
  ) => {
    const numAnalyses = analysisTypes.length;
    let avgCostPerAnalysis = 0;

    // Calculate weighted average cost based on allowed depths and scenario distribution
    allowedDepths.forEach(depth => {
      const depthKey = depth as keyof typeof DEPTH_COSTS;
      const weight = scenario[depthKey] || 0;
      avgCostPerAnalysis += DEPTH_COSTS[depthKey] * weight;
    });

    // Normalize weights if not all depths are allowed
    const totalWeight = allowedDepths.reduce((sum, d) => sum + (scenario[d as keyof typeof DISTRIBUTION_SCENARIOS['realistic']] || 0), 0);
    if (totalWeight > 0) {
      avgCostPerAnalysis = avgCostPerAnalysis / totalWeight;
    } else {
      // Default to critical if no weights match
      avgCostPerAnalysis = DEPTH_COSTS.critical;
    }

    return numAnalyses * avgCostPerAnalysis;
  };

  // Calculate plan profitability
  const calculatePlanProfitability = (planSlug: keyof typeof PLAN_CONFIGS) => {
    const config = PLAN_CONFIGS[planSlug];
    const scenario = DISTRIBUTION_SCENARIOS[selectedScenario];
    
    const costPerProject = calculateProjectCost(config.analysisTypes, config.allowedDepths, scenario);
    const maxMonthlyCost = costPerProject * config.monthlyProjects;
    const maxMonthlyCostBRL = maxMonthlyCost * USD_TO_BRL;
    
    const revenue = config.price;
    const margin = revenue > 0 ? ((revenue - maxMonthlyCostBRL) / revenue) * 100 : -100;
    const profit = revenue - maxMonthlyCostBRL;

    return {
      costPerProject,
      costPerProjectBRL: costPerProject * USD_TO_BRL,
      maxMonthlyCost,
      maxMonthlyCostBRL,
      revenue,
      margin,
      profit,
      numAnalysesPerProject: config.analysisTypes.length,
      monthlyProjects: config.monthlyProjects,
    };
  };

  // Get margin color class
  const getMarginColor = (margin: number) => {
    if (margin >= 50) return 'text-green-500';
    if (margin >= 20) return 'text-yellow-500';
    if (margin >= 0) return 'text-orange-500';
    return 'text-destructive';
  };

  // Get margin badge variant
  const getMarginBadge = (margin: number) => {
    if (margin >= 50) return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (margin >= 20) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    if (margin >= 0) return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    return 'bg-destructive/10 text-destructive border-destructive/20';
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const freePlan = calculatePlanProfitability('free');
  const basicPlan = calculatePlanProfitability('basic');
  const proPlan = calculatePlanProfitability('pro');

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
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
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
            <Crown className="w-8 h-8 text-yellow-500" />
            <h1 className="text-3xl font-bold">Planos de Assinatura</h1>
          </div>
          <p className="text-muted-foreground">
            Análise detalhada de custos e lucratividade por plano
          </p>
        </div>

        {/* Cost per Depth Level */}
        <div className="grid md:grid-cols-3 gap-4 mb-8 animate-slide-up">
          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <h3 className="font-semibold">⚡ Crítico</h3>
                <p className="text-xs text-muted-foreground">8KB context</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-yellow-500">
              ${DEPTH_COSTS.critical.toFixed(3)}
            </p>
            <p className="text-sm text-muted-foreground">por análise</p>
            <p className="text-xs text-muted-foreground mt-1">
              ≈ R$ {(DEPTH_COSTS.critical * USD_TO_BRL).toFixed(2)}
            </p>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Scale className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">⚖️ Balanceado</h3>
                <p className="text-xs text-muted-foreground">20KB context</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-blue-500">
              ${DEPTH_COSTS.balanced.toFixed(3)}
            </p>
            <p className="text-sm text-muted-foreground">por análise</p>
            <p className="text-xs text-muted-foreground mt-1">
              ≈ R$ {(DEPTH_COSTS.balanced * USD_TO_BRL).toFixed(2)}
            </p>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold">📊 Completo</h3>
                <p className="text-xs text-muted-foreground">40KB context</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-purple-500">
              ${DEPTH_COSTS.complete.toFixed(3)}
            </p>
            <p className="text-sm text-muted-foreground">por análise</p>
            <p className="text-xs text-muted-foreground mt-1">
              ≈ R$ {(DEPTH_COSTS.complete * USD_TO_BRL).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Scenario Selector */}
        <div className="mb-8 p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Calculator className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold">Simulador de Cenários</h3>
                <p className="text-sm text-muted-foreground">
                  Selecione a distribuição de profundidade esperada
                </p>
              </div>
            </div>
            <Select value={selectedScenario} onValueChange={(v) => setSelectedScenario(v as keyof typeof DISTRIBUTION_SCENARIOS)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pessimistic">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    Pessimista (70% Completo)
                  </span>
                </SelectItem>
                <SelectItem value="realistic">
                  <span className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-blue-500" />
                    Realista (Misto)
                  </span>
                </SelectItem>
                <SelectItem value="optimistic">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    Otimista (60% Crítico)
                  </span>
                </SelectItem>
                <SelectItem value="economic_mode">
                  <span className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-yellow-500" />
                    Modo Econômico
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 grid md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 bg-muted/30 rounded-lg text-center">
              <p className="text-muted-foreground mb-1">Crítico</p>
              <p className="font-semibold text-yellow-500">
                {(DISTRIBUTION_SCENARIOS[selectedScenario].critical * 100).toFixed(0)}%
              </p>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg text-center">
              <p className="text-muted-foreground mb-1">Balanceado</p>
              <p className="font-semibold text-blue-500">
                {(DISTRIBUTION_SCENARIOS[selectedScenario].balanced * 100).toFixed(0)}%
              </p>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg text-center">
              <p className="text-muted-foreground mb-1">Completo</p>
              <p className="font-semibold text-purple-500">
                {(DISTRIBUTION_SCENARIOS[selectedScenario].complete * 100).toFixed(0)}%
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg text-center">
              <p className="text-muted-foreground mb-1">Modo Atual</p>
              <p className="font-semibold text-primary">
                {economicMode ? '💰 Econômico' : '📊 Normal'}
              </p>
            </div>
          </div>
        </div>

        {/* Profitability Analysis Table */}
        <div className="mb-8 p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-3 mb-6">
            <DollarSign className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold text-lg">Análise de Lucratividade por Plano</h3>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Proj/Mês</TableHead>
                  <TableHead className="text-right">Análises/Proj</TableHead>
                  <TableHead className="text-right">Custo/Proj</TableHead>
                  <TableHead className="text-right">Custo Máx/Mês</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { name: 'Free', data: freePlan, slug: 'free' },
                  { name: 'Basic', data: basicPlan, slug: 'basic' },
                  { name: 'Pro', data: proPlan, slug: 'pro' },
                ].map(({ name, data, slug }) => (
                  <TableRow key={slug}>
                    <TableCell className="font-medium">
                      <Badge variant="outline" className={
                        slug === 'pro' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                        slug === 'basic' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                        'bg-muted'
                      }>
                        {name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      R$ {data.revenue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {data.monthlyProjects}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {data.numAnalysesPerProject}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      R$ {data.costPerProjectBRL.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      R$ {data.maxMonthlyCostBRL.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${data.profit >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                      R$ {data.profit.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={getMarginBadge(data.margin)}>
                        {data.margin.toFixed(0)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Margin Alerts */}
          <div className="mt-6 space-y-2">
            {proPlan.margin < 0 && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Alerta: Plano Pro com margem negativa!</p>
                  <p className="text-sm text-muted-foreground">
                    No cenário {selectedScenario}, o plano Pro pode ter prejuízo de R$ {Math.abs(proPlan.profit).toFixed(2)}/usuário
                  </p>
                </div>
              </div>
            )}
            {basicPlan.margin < 20 && basicPlan.margin >= 0 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="font-medium text-yellow-500">Atenção: Margem baixa no plano Basic</p>
                  <p className="text-sm text-muted-foreground">
                    Considere ajustar limites ou preço para melhorar rentabilidade
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cost per Analysis Type */}
        <div className="mb-8 p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Custo por Tipo de Análise</h3>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            {ANALYSIS_TYPES.map((type) => {
              const scenario = DISTRIBUTION_SCENARIOS[selectedScenario];
              const avgCost = (DEPTH_COSTS.critical * scenario.critical) + 
                             (DEPTH_COSTS.balanced * scenario.balanced) + 
                             (DEPTH_COSTS.complete * scenario.complete);
              
              return (
                <div key={type.key} className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm font-medium mb-2">{type.name}</p>
                  <p className="text-xl font-bold">R$ {(avgCost * USD_TO_BRL).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">${avgCost.toFixed(3)} USD</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Plans Grid */}
        <div className="mb-8">
          <h3 className="font-semibold text-lg mb-4">Detalhes dos Planos</h3>
          <div className="grid md:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            {plans.map((plan, index) => {
              const profitability = plan.slug === 'free' ? freePlan : 
                                   plan.slug === 'basic' ? basicPlan : proPlan;
              
              return (
                <div 
                  key={plan.id}
                  className={`p-6 bg-card border rounded-xl relative ${
                    plan.slug === 'pro' 
                      ? 'border-primary shadow-lg' 
                      : 'border-border'
                  }`}
                >
                  {plan.slug === 'pro' && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                      Mais Popular
                    </div>
                  )}
                  
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl font-bold">
                        {plan.price_monthly === 0 ? 'Grátis' : `R$${plan.price_monthly.toFixed(2)}`}
                      </span>
                      {plan.price_monthly > 0 && (
                        <span className="text-muted-foreground">/mês</span>
                      )}
                    </div>
                  </div>

                  {/* Profitability Indicator */}
                  <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">Margem Estimada</span>
                      <Badge className={getMarginBadge(profitability.margin)}>
                        {profitability.margin.toFixed(0)}%
                      </Badge>
                    </div>
                    <Progress 
                      value={Math.max(0, Math.min(100, profitability.margin))} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Custo máx: R$ {profitability.maxMonthlyCostBRL.toFixed(2)}/mês
                    </p>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span>Projetos/mês</span>
                        <span className="font-medium">{plan.monthly_analyses}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span>Projetos/dia</span>
                        <span className="font-medium">{plan.daily_analyses}</span>
                      </div>
                    </div>

                    <ul className="space-y-2">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                      {plan.is_active ? '✅ Plano ativo' : '❌ Plano inativo'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue Projections */}
        <div className="p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.25s" }}>
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold text-lg">Projeção de Receita vs Custo</h3>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">100 usuários Basic</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Receita:</span>
                  <span className="font-bold text-green-500">R$ {(100 * basicPlan.revenue).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Custo máx:</span>
                  <span className="font-medium text-destructive">R$ {(100 * basicPlan.maxMonthlyCostBRL).toFixed(0)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1 mt-1">
                  <span className="text-sm font-medium">Lucro:</span>
                  <span className={`font-bold ${100 * basicPlan.profit >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                    R$ {(100 * basicPlan.profit).toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">50 Basic + 50 Pro</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Receita:</span>
                  <span className="font-bold text-green-500">
                    R$ {((50 * basicPlan.revenue) + (50 * proPlan.revenue)).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Custo máx:</span>
                  <span className="font-medium text-destructive">
                    R$ {((50 * basicPlan.maxMonthlyCostBRL) + (50 * proPlan.maxMonthlyCostBRL)).toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-1 mt-1">
                  <span className="text-sm font-medium">Lucro:</span>
                  <span className={`font-bold ${((50 * basicPlan.profit) + (50 * proPlan.profit)) >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                    R$ {((50 * basicPlan.profit) + (50 * proPlan.profit)).toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">100 usuários Pro</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Receita:</span>
                  <span className="font-bold text-green-500">R$ {(100 * proPlan.revenue).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Custo máx:</span>
                  <span className="font-medium text-destructive">R$ {(100 * proPlan.maxMonthlyCostBRL).toFixed(0)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1 mt-1">
                  <span className="text-sm font-medium">Lucro:</span>
                  <span className={`font-bold ${100 * proPlan.profit >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                    R$ {(100 * proPlan.profit).toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Break-even info */}
          <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <h4 className="font-medium mb-2">💡 Dica de Break-even</h4>
            <p className="text-sm text-muted-foreground">
              Para o plano Pro ser lucrativo no cenário <strong>{selectedScenario}</strong>, 
              os usuários precisam usar em média menos de{' '}
              <strong>{proPlan.margin >= 0 ? '100%' : Math.floor((proPlan.revenue / proPlan.maxMonthlyCostBRL) * proPlan.monthlyProjects)}</strong> projetos/mês,
              ou migrar para profundidades mais econômicas (Crítico/Balanceado).
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPlans;
