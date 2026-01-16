import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Github, 
  Loader2, 
  DollarSign,
  Users,
  TrendingUp,
  Calculator,
  ArrowLeft,
  Zap,
  BarChart3,
  Flame,
  Leaf,
  AlertTriangle,
  Trophy,
  PieChart as PieChartIcon,
  GitCompare,
  Lightbulb,
  CheckCircle2,
  Rocket,
  Scale,
  Info
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/useAdmin";
import { useRealModelCosts, isValidCostData } from "@/hooks/useRealModelCosts";
import { MODEL_COSTS, USD_TO_BRL, DEPTH_TOKEN_ESTIMATES, formatCostBRL, formatCostPer1M, formatCostPer1MBRL } from "@/lib/modelCosts";
import { isEconomicModel } from "@/lib/modelCategories";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CostStats {
  totalAnalyses: number;
  estimatedTotalCost: number;
  avgCostPerAnalysis: number;
  avgCostPerUser: number;
  totalUsers: number;
  totalTokens: number;
}

interface DailyUsage {
  date: string;
  analyses: number;
  cost: number;
  tokens: number;
}

interface UserCost {
  userId: string;
  email: string;
  analysesCount: number;
  estimatedCost: number;
  totalTokens: number;
  planName: string;
}

interface DepthStats {
  depth: string;
  count: number;
  avgTokens: number;
  avgCost: number;
  totalCost: number;
  hasOutliers?: boolean;
  outlierCount?: number;
  dataQuality?: { label: string; color: string; icon: string } | null;
}

interface ModelUsageStats {
  provider: string;
  modelName: string;
  modelKey: string;
  count: number;
  avgTokens: number;
  avgCost: number;
  totalCost: number;
  isEconomic: boolean;
  hasOutliers?: boolean;
  outlierCount?: number;
  dataQuality?: { label: string; color: string; icon: string } | null;
}

interface AnalysisTypeStats {
  type: string;
  detailedCount: number;
  economicCount: number;
  detailedCost: number;
  economicCost: number;
  totalCost: number;
  avgCost: number;
}

interface PlanData {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  max_tokens_monthly: number | null;
}

// Removed hardcoded COST_PER_ANALYSIS - using real data from analysis_usage

const DEPTH_COLORS = {
  'critical': 'hsl(142, 76%, 36%)',
  'balanced': 'hsl(217, 91%, 60%)', 
  'complete': 'hsl(262, 83%, 58%)',
};

const MODE_COLORS = {
  'detailed': 'hsl(25, 95%, 53%)',
  'economic': 'hsl(142, 76%, 36%)',
};

const ANALYSIS_TYPES_PT: Record<string, string> = {
  'prd': 'Análise PRD',
  'divulgacao': 'Marketing & Lançamento',
  'captacao': 'Pitch para Investidores',
  'seguranca': 'Melhorias de Segurança',
  'ui_theme': 'Melhorias UI/Theme',
  'ferramentas': 'Melhorias de Ferramentas',
  'features': 'Novas Features',
  'documentacao': 'Documentação Técnica',
  'prompts': 'Prompts Otimizados',
  'qualidade': 'Qualidade de Código',
};

// Convert MODEL_COSTS to ALL_MODELS format for compatibility
const ALL_MODELS = MODEL_COSTS.map(m => ({
  provider: m.provider,
  name: m.name,
  inputPer1M: m.inputPer1K * 1000,
  outputPer1M: m.outputPer1K * 1000,
  costPer1K: (m.inputPer1K + m.outputPer1K) / 2,
})).sort((a, b) => a.costPer1K - b.costPer1K);

const RANKING_BADGES = ['🥇', '🥈', '🥉'];

// System Recommendation Tab Component
interface SystemRecommendationTabProps {
  modelUsageStats: ModelUsageStats[];
  depthStats: DepthStats[];
  hasRealData: boolean;
}

const SystemRecommendationTab = ({ modelUsageStats, depthStats, hasRealData }: SystemRecommendationTabProps) => {
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [depthFilter, setDepthFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [savingConfig, setSavingConfig] = useState<string | null>(null);

  // Get real costs from usage or fallback to MODEL_COSTS
  const modelsWithRealCosts = useMemo(() => {
    const realCostsByModel: Record<string, { costPer1K: number; avgTokens: number; count: number }> = {};
    
    modelUsageStats.forEach(m => {
      if (m.totalCost > 0 && m.avgTokens > 0) {
        realCostsByModel[m.modelKey] = {
          costPer1K: (m.totalCost / (m.avgTokens * m.count / 1000)),
          avgTokens: m.avgTokens,
          count: m.count
        };
      }
    });

    return ALL_MODELS.map(model => {
      const key = model.name.toLowerCase().replace(/\s+/g, '-');
      const realData = realCostsByModel[key];
      return {
        ...model,
        realCostPer1K: realData?.costPer1K || model.costPer1K,
        hasRealData: !!realData,
        usageCount: realData?.count || 0
      };
    });
  }, [modelUsageStats]);

  // Filter models by provider
  const filteredModels = useMemo(() => {
    let models = modelsWithRealCosts;
    if (providerFilter !== "all") {
      models = models.filter(m => m.provider === providerFilter);
    }
    return models.sort((a, b) => a.realCostPer1K - b.realCostPer1K);
  }, [modelsWithRealCosts, providerFilter]);

  // Get depth tokens (real or default) - prioritize real data from depthStats
  // Returns both tokens and sample count for data quality indicator
  const getDepthTokensWithCount = (depth: string): { tokens: number; count: number; isReal: boolean } => {
    const realDepth = depthStats.find(d => d.depth === depth);
    if (realDepth && realDepth.avgTokens > 0) {
      return { tokens: realDepth.avgTokens, count: realDepth.count, isReal: true };
    }
    // Fallback para estimativas padrão por profundidade
    const defaultTokens: Record<string, number> = {
      critical: DEPTH_TOKEN_ESTIMATES.critical,    // ~8K tokens
      balanced: DEPTH_TOKEN_ESTIMATES.balanced,    // ~15K tokens
      complete: DEPTH_TOKEN_ESTIMATES.complete     // ~25K tokens
    };
    return { 
      tokens: defaultTokens[depth] || 15000, 
      count: 0, 
      isReal: false 
    };
  };

  const getDepthTokens = (depth: string): number => {
    return getDepthTokensWithCount(depth).tokens;
  };

  // Check if depth filter is active (affects comparison mode)
  const isDepthFilterActive = depthFilter !== "all";

  // Verificar se tokens são iguais para todos os perfis (quando filtro está ativo)
  const allTokensEqual = (recs: typeof recommendations) => {
    if (recs.length < 2) return false;
    return recs.every(r => r.tokens === recs[0].tokens);
  };

  // Calculate recommendation profiles
  const recommendations = useMemo(() => {
    if (filteredModels.length === 0) return [];

    const selectedDepth = depthFilter !== "all" ? depthFilter : null;
    const selectedMode = modeFilter !== "all" ? modeFilter : null;

    // Filter by economic mode if selected
    let modelsForEconomic = filteredModels;
    let modelsForPerformance = filteredModels;
    
    if (selectedMode === "economic") {
      modelsForEconomic = filteredModels.filter(m => 
        m.name.includes("Lite") || m.name.includes("Nano") || m.name.includes("Mini")
      );
      modelsForPerformance = modelsForEconomic;
    } else if (selectedMode === "detailed") {
      modelsForPerformance = filteredModels.filter(m => 
        !m.name.includes("Lite") && !m.name.includes("Nano")
      );
      modelsForEconomic = modelsForPerformance;
    }

    if (modelsForEconomic.length === 0) modelsForEconomic = filteredModels;
    if (modelsForPerformance.length === 0) modelsForPerformance = filteredModels;

    // CORREÇÃO: Quando filtro de depth está ativo, todos usam mesma depth MAS modelos diferentes
    // Quando filtro de depth NÃO está ativo, cada perfil usa sua depth padrão
    
    // Mais Econômico - cheapest model
    const economicModel = modelsForEconomic[0];
    const economicDepth = selectedDepth || "critical";
    const economicDepthData = getDepthTokensWithCount(economicDepth);
    const economicTokens = economicDepthData.tokens;
    const economicCostPerAnalysis = (economicTokens / 1000) * economicModel.realCostPer1K;

    // Equilibrado - middle model
    // CORREÇÃO: Quando depth filter ativo, usa a MESMA depth para comparar MODELOS
    const balancedIndex = Math.floor(filteredModels.length / 2);
    const balancedModel = filteredModels[balancedIndex] || filteredModels[0];
    const balancedDepth = selectedDepth || "balanced"; // Usa depth selecionada se filtro ativo
    const balancedDepthData = getDepthTokensWithCount(balancedDepth);
    const balancedTokens = balancedDepthData.tokens;
    const balancedCostPerAnalysis = (balancedTokens / 1000) * balancedModel.realCostPer1K;

    // Melhor Performance - most powerful model
    const performanceModel = modelsForPerformance[modelsForPerformance.length - 1];
    const performanceDepth = selectedDepth || "complete"; // Usa depth selecionada se filtro ativo
    const performanceDepthData = getDepthTokensWithCount(performanceDepth);
    const performanceTokens = performanceDepthData.tokens;
    const performanceCostPerAnalysis = (performanceTokens / 1000) * performanceModel.realCostPer1K;

    return [
      {
        id: "economic",
        name: "Mais Econômico",
        icon: <Leaf className="w-6 h-6 text-green-500" />,
        color: "green",
        model: economicModel,
        depth: economicDepth,
        mode: "Econômico",
        tokens: economicTokens,
        sampleCount: economicDepthData.count,
        isRealData: economicDepthData.isReal,
        costPerAnalysis: economicCostPerAnalysis,
        costPer100: economicCostPerAnalysis * 100,
        description: selectedDepth 
          ? `Modelo mais barato para profundidade ${selectedDepth}` 
          : "Menor custo possível mantendo qualidade básica"
      },
      {
        id: "balanced",
        name: "Equilibrado",
        icon: <Scale className="w-6 h-6 text-blue-500" />,
        color: "blue",
        model: balancedModel,
        depth: balancedDepth,
        mode: "Balanceado",
        tokens: balancedTokens,
        sampleCount: balancedDepthData.count,
        isRealData: balancedDepthData.isReal,
        costPerAnalysis: balancedCostPerAnalysis,
        costPer100: balancedCostPerAnalysis * 100,
        description: selectedDepth 
          ? `Modelo intermediário para profundidade ${selectedDepth}` 
          : "Melhor relação custo-benefício"
      },
      {
        id: "performance",
        name: "Melhor Performance",
        icon: <Rocket className="w-6 h-6 text-purple-500" />,
        color: "purple",
        model: performanceModel,
        depth: performanceDepth,
        mode: "Detalhado",
        tokens: performanceTokens,
        sampleCount: performanceDepthData.count,
        isRealData: performanceDepthData.isReal,
        costPerAnalysis: performanceCostPerAnalysis,
        costPer100: performanceCostPerAnalysis * 100,
        description: selectedDepth 
          ? `Modelo premium para profundidade ${selectedDepth}` 
          : "Máxima qualidade e profundidade"
      }
    ];
  }, [filteredModels, depthFilter, modeFilter, depthStats]);

  const handleApplyConfig = async (profile: typeof recommendations[0]) => {
    setSavingConfig(profile.id);
    try {
      // Map depth to config key
      const depthConfigKey = `${profile.depth}_config`;
      
      // Get model identifier for storage
      const modelId = profile.model.provider === 'Lovable AI' 
        ? `google/${profile.model.name.toLowerCase().replace(/\s+/g, '-')}`
        : profile.model.name.toLowerCase().replace(/\s+/g, '-');

      // Update system settings with recommended config
      const updates = [
        { key: 'recommended_model', value: modelId },
        { key: 'recommended_depth', value: profile.depth },
        { key: 'recommended_mode', value: profile.mode.toLowerCase() },
        { key: 'last_recommendation_applied', value: new Date().toISOString() }
      ];

      for (const update of updates) {
        await supabase.from("system_settings").upsert({
          key: update.key,
          value: update.value,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      }

      toast.success(`Configuração "${profile.name}" aplicada com sucesso!`);
    } catch (error) {
      console.error("Error applying config:", error);
      toast.error("Erro ao aplicar configuração");
    } finally {
      setSavingConfig(null);
    }
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case "green": return "bg-green-500/10 border-green-500/30 hover:border-green-500/50";
      case "blue": return "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50";
      case "purple": return "bg-purple-500/10 border-purple-500/30 hover:border-purple-500/50";
      default: return "bg-muted/50 border-border";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl">
        <div className="flex items-center gap-3 mb-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold">Recomendações Inteligentes</h3>
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
            Usa Mediana
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          O sistema analisa seus dados de uso e sugere configurações otimizadas para diferentes objetivos.
          {hasRealData ? " Cálculos baseados em dados reais do sistema usando mediana (proteção contra outliers)." : " Usando estimativas - execute análises para dados mais precisos."}
        </p>
      </div>

      {/* Filters */}
      <div className="p-4 bg-card border border-border rounded-xl">
        <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Filtros de Seleção
        </h4>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Provider</label>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Lovable AI">🟢 Lovable AI</SelectItem>
                <SelectItem value="OpenAI">🔵 OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Profundidade</label>
            <Select value={depthFilter} onValueChange={setDepthFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="critical">⚡ Critical</SelectItem>
                <SelectItem value="balanced">⚖️ Balanced</SelectItem>
                <SelectItem value="complete">📊 Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Modo</label>
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="economic">🌿 Econômico</SelectItem>
                <SelectItem value="detailed">🔥 Detalhado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Recommendation Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {recommendations.map((rec) => (
          <div 
            key={rec.id}
            className={`p-6 border rounded-xl transition-all ${getColorClasses(rec.color)}`}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              {rec.icon}
              <div>
                <h3 className="font-semibold">{rec.name}</h3>
                <p className="text-xs text-muted-foreground">{rec.description}</p>
              </div>
            </div>

            {/* Data Quality Indicator */}
            {rec.sampleCount > 0 && rec.sampleCount < 10 && (
              <div className="flex items-center gap-2 p-2 mb-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-amber-600">Poucos dados ({rec.sampleCount} amostras)</span>
              </div>
            )}

            {/* Config Details */}
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center p-2 bg-background/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Provider</span>
                <Badge variant="outline" className="text-xs">
                  {rec.model.provider === 'Lovable AI' ? '🟢' : '🔵'} {rec.model.provider}
                </Badge>
              </div>
              <div className="flex justify-between items-center p-2 bg-background/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Modelo</span>
                <span className="text-sm font-medium">{rec.model.name}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-background/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Profundidade</span>
                <Badge variant="outline" className="text-xs capitalize">{rec.depth}</Badge>
              </div>
              <div className="flex justify-between items-center p-2 bg-background/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Tokens/Análise</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">{rec.tokens.toLocaleString()}</span>
                  {!rec.isRealData && (
                    <span className="text-xs text-muted-foreground">(est.)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Cost Estimates */}
            <div className="p-3 bg-background/80 rounded-lg mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Custo/Análise</span>
                <span className="font-semibold text-green-600">
                  R$ {(rec.costPerAnalysis * USD_TO_BRL).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Custo/100 Análises</span>
                <span className="font-semibold">
                  R$ {(rec.costPer100 * USD_TO_BRL).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Apply Button */}
            <Button 
              onClick={() => handleApplyConfig(rec)} 
              className="w-full"
              variant={rec.color === "green" ? "default" : "outline"}
              disabled={savingConfig === rec.id}
            >
              {savingConfig === rec.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Aplicar Configuração
            </Button>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold">Comparativo de Custos</h4>
          {isDepthFilterActive ? (
            <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600">
              Comparando modelos na profundidade {depthFilter}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600">
              Comparando profundidades + modelos
            </Badge>
          )}
        </div>
        
        {/* Nota explicativa baseada no estado do filtro */}
        {isDepthFilterActive ? (
          <div className="flex items-start gap-2 p-3 mb-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong>Filtrando por profundidade:</strong> Todos os perfis usam <strong>{depthFilter}</strong> ({recommendations[0]?.tokens.toLocaleString()} tokens). 
              A diferença de custo é exclusivamente pela escolha do <strong>modelo de IA</strong>.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 mb-4 bg-green-500/5 border border-green-500/20 rounded-lg">
            <Info className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong>Comparação completa:</strong> Cada perfil usa profundidade diferente — 
              Econômico: <strong>critical</strong> (~{getDepthTokens("critical").toLocaleString()} tokens), 
              Equilibrado: <strong>balanced</strong> (~{getDepthTokens("balanced").toLocaleString()} tokens), 
              Performance: <strong>complete</strong> (~{getDepthTokens("complete").toLocaleString()} tokens).
            </p>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2">Perfil</th>
                <th className="text-left py-2 px-2">Modelo</th>
                <th className="text-center py-2 px-2">Profundidade</th>
                <th className="text-center py-2 px-2">Tokens/Análise</th>
                <th className="text-right py-2 px-2">Custo/1K</th>
                <th className="text-right py-2 px-2">Custo/Análise</th>
                <th className="text-right py-2 px-2">Economia vs Performance</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((rec, idx) => {
                const performanceCost = recommendations[2]?.costPerAnalysis || rec.costPerAnalysis;
                const savings = performanceCost > 0 
                  ? ((1 - rec.costPerAnalysis / performanceCost) * 100).toFixed(0)
                  : "0";
                return (
                  <tr key={rec.id} className="border-b border-border/50">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        {rec.icon}
                        <span className="font-medium">{rec.name}</span>
                        {rec.sampleCount > 0 && rec.sampleCount < 10 && (
                          <span title={`${rec.sampleCount} amostras`}>
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <Badge variant="outline" className="text-xs">
                        {rec.model.provider === 'Lovable AI' ? '🟢' : '🔵'} {rec.model.name}
                      </Badge>
                    </td>
                    <td className="text-center py-3 px-2">
                      <Badge variant="secondary" className="text-xs capitalize">{rec.depth}</Badge>
                    </td>
                    <td className="text-center py-3 px-2">
                      <div className="flex items-center justify-center gap-1">
                        <span>{rec.tokens.toLocaleString()}</span>
                        {!rec.isRealData && (
                          <span className="text-xs text-muted-foreground">(est.)</span>
                        )}
                      </div>
                    </td>
                    <td className="text-right py-3 px-2">R$ {(rec.model.realCostPer1K * USD_TO_BRL).toFixed(4)}</td>
                    <td className="text-right py-3 px-2 font-medium">
                      R$ {(rec.costPerAnalysis * USD_TO_BRL).toFixed(4)}
                    </td>
                    <td className="text-right py-3 px-2">
                      {idx < 2 ? (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                          -{savings}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Referência</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AdminCosts = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [stats, setStats] = useState<CostStats | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [userCosts, setUserCosts] = useState<UserCost[]>([]);
  const [depthStats, setDepthStats] = useState<DepthStats[]>([]);
  const [modelUsageStats, setModelUsageStats] = useState<ModelUsageStats[]>([]);
  const [analysisTypeStats, setAnalysisTypeStats] = useState<AnalysisTypeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);
  const [realCostPer1K, setRealCostPer1K] = useState<number>(0.0055);
  const [plans, setPlans] = useState<PlanData[]>([]);

  useEffect(() => {
    if (adminLoading) return;
    if (!isAdmin) {
      toast.error("Acesso negado. Área restrita para administradores.");
      navigate("/dashboard");
      return;
    }
    loadCostData();
  }, [isAdmin, adminLoading, navigate]);

  const loadCostData = async () => {
    try {
      // Load plans from database
      const { data: plansData } = await supabase
        .from("plans")
        .select("id, name, slug, price_monthly, config")
        .eq("is_active", true);

      const parsedPlans: PlanData[] = (plansData || []).map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price_monthly: Number(p.price_monthly) || 0,
        max_tokens_monthly: (p.config as any)?.max_tokens_monthly || null,
      }));
      setPlans(parsedPlans);

      // Get real usage data, excluding legacy corrupted records
      const { data: rawUsageData } = await supabase
        .from("analysis_usage")
        .select("*")
        .or('is_legacy_cost.is.null,is_legacy_cost.eq.false');

      // Additional filter for any data not yet marked as legacy
      const usageData = rawUsageData?.filter(u => 
        !u.is_legacy_cost && isValidCostData(u.cost_estimated, u.tokens_estimated)
      ) || [];
      
      // Filtered data: ${usageData.length}/${rawUsageData?.length || 0} valid records

      const realTotalCost = usageData.reduce((sum, u) => sum + Number(u.cost_estimated || 0), 0);
      const realTotalTokens = usageData.reduce((sum, u) => sum + (u.tokens_estimated || 0), 0);

      if (realTotalTokens > 0 && realTotalCost > 0) {
        const costPer1K = (realTotalCost * USD_TO_BRL) / (realTotalTokens / 1000);
        setRealCostPer1K(costPer1K);
      }

      const { count: totalAnalyses } = await supabase
        .from("analyses")
        .select("*", { count: "exact", head: true });

      const { data: projects } = await supabase
        .from("projects")
        .select("user_id")
        .not("user_id", "is", null);

      const uniqueUsers = new Set(projects?.map(p => p.user_id) || []);
      const totalUsers = uniqueUsers.size;

      const hasRealUsageData = usageData.length > 0;
      setHasRealData(hasRealUsageData);
      
      // Use real data when available, fallback to 0 when no data (not hardcoded estimate)
      const estimatedTotalCost = realTotalCost;
      const avgCostPerAnalysis = totalAnalyses && totalAnalyses > 0 
        ? estimatedTotalCost / totalAnalyses 
        : 0;
      const avgCostPerUser = totalUsers > 0 ? estimatedTotalCost / totalUsers : 0;

      setStats({
        totalAnalyses: totalAnalyses || 0,
        estimatedTotalCost,
        avgCostPerAnalysis,
        avgCostPerUser,
        totalUsers,
        totalTokens: realTotalTokens,
      });

      // Daily usage
      const dailyMap = new Map<string, { analyses: number; cost: number; tokens: number }>();
      
      if (hasRealUsageData) {
        usageData?.forEach(u => {
          const date = new Date(u.created_at!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          const existing = dailyMap.get(date) || { analyses: 0, cost: 0, tokens: 0 };
          dailyMap.set(date, {
            analyses: existing.analyses + 1,
            cost: existing.cost + Number(u.cost_estimated || 0),
            tokens: existing.tokens + (u.tokens_estimated || 0),
          });
        });
      }

      const dailyData: DailyUsage[] = Array.from(dailyMap.entries())
        .map(([date, data]) => ({ date, analyses: data.analyses, cost: data.cost, tokens: data.tokens }))
        .sort((a, b) => {
          const [dayA, monthA] = a.date.split('/').map(Number);
          const [dayB, monthB] = b.date.split('/').map(Number);
          return monthA - monthB || dayA - dayB;
        })
        .slice(-14);

      setDailyUsage(dailyData);

      // Model usage statistics - using MEDIAN for tokens to protect against outliers
      const modelTokenArrays = new Map<string, number[]>();
      const modelCostArrays = new Map<string, number[]>();
      
      usageData?.forEach(u => {
        const modelKey = u.model_used || 'unknown';
        const tokens = u.tokens_estimated || 0;
        const cost = Number(u.cost_estimated || 0);
        
        if (!modelTokenArrays.has(modelKey)) {
          modelTokenArrays.set(modelKey, []);
          modelCostArrays.set(modelKey, []);
        }
        
        if (tokens > 0) {
          modelTokenArrays.get(modelKey)!.push(tokens);
          modelCostArrays.get(modelKey)!.push(cost);
        }
      });

      // Function to calculate median (reusable)
      const calculateMedian = (arr: number[]): number => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0
          ? sorted[mid]
          : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
      };

      // Function to calculate trimmed median (removes top 15% and bottom 15% outliers)
      const calculateTrimmedMedian = (arr: number[]): number => {
        if (arr.length === 0) return 0;
        if (arr.length < 7) return calculateMedian(arr); // Too few items, use regular median
        
        const sorted = [...arr].sort((a, b) => a - b);
        const trimPercent = 0.15;
        const trimCount = Math.floor(sorted.length * trimPercent);
        const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
        
        if (trimmed.length === 0) return calculateMedian(arr); // Fallback if over-trimmed
        
        const mid = Math.floor(trimmed.length / 2);
        return trimmed.length % 2 !== 0
          ? trimmed[mid]
          : Math.round((trimmed[mid - 1] + trimmed[mid]) / 2);
      };

      // Function to detect outliers (values > 2.5x the median)
      const detectOutliers = (arr: number[]): { hasOutliers: boolean; outlierCount: number; medianValue: number } => {
        if (arr.length < 5) return { hasOutliers: false, outlierCount: 0, medianValue: 0 };
        const median = calculateMedian(arr);
        const threshold = median * 2.5;
        const outliers = arr.filter(v => v > threshold);
        return { hasOutliers: outliers.length > 0, outlierCount: outliers.length, medianValue: median };
      };

      // Function to get data quality indicator
      const getDataQualityLabel = (count: number): { label: string; color: string; icon: string } | null => {
        if (count < 5) return { label: '⚠️ Amostra muito pequena', color: 'text-red-500', icon: '⚠️' };
        if (count < 10) return { label: '(dados limitados)', color: 'text-amber-500', icon: '📊' };
        return null;
      };

      // Map model keys to display names and providers - using centralized isEconomicModel
      const getModelInfo = (modelKey: string): { provider: string; displayName: string; isEconomic: boolean } => {
        const lowerKey = modelKey.toLowerCase();
        let provider = 'Unknown';
        let displayName = modelKey;
        
        // Determine provider and display name
        if (lowerKey.includes('gpt-5-mini')) { provider = 'OpenAI'; displayName = 'GPT-5 Mini'; }
        else if (lowerKey.includes('gpt-5-nano')) { provider = 'OpenAI'; displayName = 'GPT-5 Nano'; }
        else if (lowerKey.includes('gpt-5')) { provider = 'OpenAI'; displayName = 'GPT-5'; }
        else if (lowerKey.includes('gpt-4.1-mini')) { provider = 'OpenAI'; displayName = 'GPT-4.1 Mini'; }
        else if (lowerKey.includes('gpt-4.1-nano')) { provider = 'OpenAI'; displayName = 'GPT-4.1 Nano'; }
        else if (lowerKey.includes('gpt-4.1')) { provider = 'OpenAI'; displayName = 'GPT-4.1'; }
        else if (lowerKey.includes('gpt-4o-mini')) { provider = 'OpenAI'; displayName = 'GPT-4o Mini'; }
        else if (lowerKey.includes('gpt-4o')) { provider = 'OpenAI'; displayName = 'GPT-4o'; }
        else if (lowerKey.includes('o4-mini')) { provider = 'OpenAI'; displayName = 'O4 Mini'; }
        else if (lowerKey.includes('o3')) { provider = 'OpenAI'; displayName = 'O3'; }
        else if (lowerKey.includes('flash-lite') || lowerKey.includes('flash_lite')) { provider = 'Lovable AI'; displayName = 'Gemini 2.5 Flash Lite'; }
        else if (lowerKey.includes('flash')) { provider = 'Lovable AI'; displayName = 'Gemini 2.5 Flash'; }
        else if (lowerKey.includes('gemini') && lowerKey.includes('pro')) { provider = 'Lovable AI'; displayName = 'Gemini 2.5 Pro'; }
        
        // Use centralized function for economic classification
        return { provider, displayName, isEconomic: isEconomicModel(modelKey) };
      };

      const modelUsageData: ModelUsageStats[] = Array.from(modelTokenArrays.entries())
        .filter(([_, tokenArr]) => tokenArr.length > 0)
        .map(([modelKey, tokenArr]) => {
          const costArr = modelCostArrays.get(modelKey) || [];
          const info = getModelInfo(modelKey);
          const outlierInfo = detectOutliers(tokenArr);
          const dataQuality = getDataQualityLabel(tokenArr.length);
          return {
            provider: info.provider,
            modelName: info.displayName,
            modelKey,
            count: tokenArr.length,
            avgTokens: calculateTrimmedMedian(tokenArr), // Using TRIMMED MEDIAN
            avgCost: calculateTrimmedMedian(costArr),
            totalCost: costArr.reduce((sum, c) => sum + c, 0),
            isEconomic: info.isEconomic,
            hasOutliers: outlierInfo.hasOutliers,
            outlierCount: outlierInfo.outlierCount,
            dataQuality,
          };
        })
        .sort((a, b) => b.totalCost - a.totalCost);
      setModelUsageStats(modelUsageData);

      // Depth statistics - using MEDIAN instead of MEAN to protect against outliers
      const depthTokenArrays = new Map<string, number[]>();
      const depthCostArrays = new Map<string, number[]>();
      
      usageData?.forEach(u => {
        const depth = u.depth_level || 'complete';
        const tokens = u.tokens_estimated || 0;
        const cost = Number(u.cost_estimated || 0);
        
        if (!depthTokenArrays.has(depth)) {
          depthTokenArrays.set(depth, []);
          depthCostArrays.set(depth, []);
        }
        
        if (tokens > 0) {
          depthTokenArrays.get(depth)!.push(tokens);
          depthCostArrays.get(depth)!.push(cost);
        }
      });

      // Depth statistics - using TRIMMED MEDIAN to protect against outliers

      const depthStatsData: DepthStats[] = ['critical', 'balanced', 'complete'].map(d => {
        const tokenArr = depthTokenArrays.get(d) || [];
        const costArr = depthCostArrays.get(d) || [];
        
        if (tokenArr.length > 0) {
          const outlierInfo = detectOutliers(tokenArr);
          const dataQuality = getDataQualityLabel(tokenArr.length);
          return {
            depth: d,
            count: tokenArr.length,
            avgTokens: calculateTrimmedMedian(tokenArr), // Using TRIMMED MEDIAN
            avgCost: calculateTrimmedMedian(costArr),
            totalCost: costArr.reduce((sum, c) => sum + c, 0),
            hasOutliers: outlierInfo.hasOutliers,
            outlierCount: outlierInfo.outlierCount,
            dataQuality,
          };
        }
        return { depth: d, count: 0, avgTokens: 0, avgCost: 0, totalCost: 0 };
      });
      setDepthStats(depthStatsData);

      // Analysis type statistics
      const typeMap = new Map<string, { detailedCount: number; economicCount: number; detailedCost: number; economicCost: number; totalCost: number }>();
      usageData?.forEach(u => {
        const type = u.analysis_type || 'unknown';
        const isEconomic = u.model_used?.includes('lite');
        const cost = Number(u.cost_estimated || 0);
        const existing = typeMap.get(type) || { detailedCount: 0, economicCount: 0, detailedCost: 0, economicCost: 0, totalCost: 0 };
        typeMap.set(type, {
          detailedCount: existing.detailedCount + (isEconomic ? 0 : 1),
          economicCount: existing.economicCount + (isEconomic ? 1 : 0),
          detailedCost: existing.detailedCost + (isEconomic ? 0 : cost),
          economicCost: existing.economicCost + (isEconomic ? cost : 0),
          totalCost: existing.totalCost + cost,
        });
      });

      const typeStatsData: AnalysisTypeStats[] = Array.from(typeMap.entries())
        .map(([type, data]) => ({
          type,
          detailedCount: data.detailedCount,
          economicCount: data.economicCount,
          detailedCost: data.detailedCost,
          economicCost: data.economicCost,
          totalCost: data.totalCost,
          avgCost: data.totalCost / (data.detailedCount + data.economicCount),
        }))
        .sort((a, b) => (b.detailedCount + b.economicCount) - (a.detailedCount + a.economicCount));
      setAnalysisTypeStats(typeStatsData);

      // User costs with profiles
      const { data: profiles } = await supabase.from("profiles").select("id, email");
      const profileMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

      const userCostMap = new Map<string, { count: number; cost: number; tokens: number }>();
      if (hasRealUsageData) {
        usageData?.forEach(u => {
          const existing = userCostMap.get(u.user_id) || { count: 0, cost: 0, tokens: 0 };
          userCostMap.set(u.user_id, {
            count: existing.count + 1,
            cost: existing.cost + Number(u.cost_estimated || 0),
            tokens: existing.tokens + (u.tokens_estimated || 0),
          });
        });
      }

      const { data: subscriptions } = await supabase
        .from("user_subscriptions")
        .select(`user_id, plans (name)`)
        .eq("status", "active");

      const userPlanMap = new Map<string, string>();
      subscriptions?.forEach(s => {
        if (s.user_id && s.plans) {
          userPlanMap.set(s.user_id, (s.plans as any).name || 'Free');
        }
      });

      const userCostData: UserCost[] = Array.from(userCostMap.entries())
        .map(([userId, data]) => ({
          userId,
          email: profileMap.get(userId) || `user-${userId.slice(0, 8)}...`,
          analysesCount: data.count,
          estimatedCost: data.cost,
          totalTokens: data.tokens,
          planName: userPlanMap.get(userId) || 'Free',
        }))
        .sort((a, b) => b.estimatedCost - a.estimatedCost)
        .slice(0, 10);

      setUserCosts(userCostData);
    } catch (error) {
      console.error("Erro ao carregar dados de custos:", error);
      toast.error("Erro ao carregar dados de custos");
    } finally {
      setLoading(false);
    }
  };

  // Criar estimativas dinâmicas por profundidade e modelo usando dados reais
  // MUST be before any early returns to avoid React hooks error
  const depthModelEstimations = useMemo(() => {
    const depths = ['critical', 'balanced', 'complete'] as const;
    // Use DEPTH_TOKEN_ESTIMATES as default fallback
    const defaultTokens = DEPTH_TOKEN_ESTIMATES;
    
    // Extrair modelos únicos dos dados reais
    const uniqueModels = modelUsageStats.map(m => ({
      key: m.modelKey,
      name: m.modelName,
      provider: m.provider,
      isEconomic: m.isEconomic,
      realCostPer1K: m.count > 0 && m.avgTokens > 0 ? (m.avgCost / m.avgTokens) * 1000 : null,
    }));
    
    // Se não houver dados reais, usar modelos padrão
    if (uniqueModels.length === 0) {
      return {
        depths: depths.map(d => ({ 
          depth: d, 
          tokens: defaultTokens[d],
          sampleCount: 0,
          label: d.charAt(0).toUpperCase() + d.slice(1) 
        })),
        models: [
          { key: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Lovable AI', isEconomic: false, realCostPer1K: 0.00075 },
          { key: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'Lovable AI', isEconomic: true, realCostPer1K: 0.000375 },
        ],
        data: [] as { depth: string; tokens: number; sampleCount: number; costs: Record<string, number> }[],
      };
    }

    // Calcular tokens médios reais por profundidade (independente do modelo)
    const realTokensByDepth: Record<string, { tokens: number; count: number }> = {};
    depthStats.forEach(d => {
      if (d.count > 0) realTokensByDepth[d.depth] = { tokens: d.avgTokens, count: d.count };
    });
    
    // Gerar dados por profundidade
    const data = depths.map(depth => {
      const depthData = realTokensByDepth[depth];
      const tokens = depthData?.tokens || defaultTokens[depth];
      const sampleCount = depthData?.count || 0;
      const costs: Record<string, number> = {};
      
      uniqueModels.forEach(model => {
        const costPer1K = model.realCostPer1K || 0.001;
        costs[model.key] = (tokens / 1000) * costPer1K * USD_TO_BRL;
      });
      
      return { depth, tokens, sampleCount, costs };
    });
    
    return { 
      depths: depths.map(d => ({ 
        depth: d, 
        tokens: realTokensByDepth[d]?.tokens || defaultTokens[d],
        sampleCount: realTokensByDepth[d]?.count || 0,
        label: d.charAt(0).toUpperCase() + d.slice(1) 
      })),
      models: uniqueModels, 
      data 
    };
  }, [modelUsageStats, depthStats]);

  // Early return AFTER useMemo hook
  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Derived calculations
  const dailyAvg = dailyUsage.length > 0 
    ? dailyUsage.reduce((sum, d) => sum + d.analyses, 0) / dailyUsage.length 
    : 0;
  const monthlyProjection = dailyAvg * 30;
  const monthlyProjectedCost = stats ? (stats.avgCostPerAnalysis * monthlyProjection) : 0;

  const modePieData = modelUsageStats.map(m => ({
    name: m.modelName,
    value: m.count,
    color: m.isEconomic ? MODE_COLORS['economic'] : MODE_COLORS['detailed'],
  }));

  const depthPieData = depthStats.filter(d => d.count > 0).map(d => ({
    name: d.depth.charAt(0).toUpperCase() + d.depth.slice(1),
    value: d.count,
    color: DEPTH_COLORS[d.depth as keyof typeof DEPTH_COLORS],
  }));

  const detailedModels = modelUsageStats.filter(m => !m.isEconomic);
  const totalDetailedAnalyses = detailedModels.reduce((sum, m) => sum + m.count, 0);
  const avgDetailedCost = detailedModels.length > 0 
    ? detailedModels.reduce((sum, m) => sum + m.totalCost, 0) / totalDetailedAnalyses 
    : 0;
  const potentialSavings = totalDetailedAnalyses * avgDetailedCost * 0.8;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <Github className="w-6 h-6 text-foreground" />
            <span className="font-semibold text-xl">GitAnalyzer</span>
            <span className="px-2 py-0.5 text-xs bg-red-500/10 text-red-500 rounded-full font-medium">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8 text-green-500" />
            <h1 className="text-3xl font-bold">Custos e Projeções</h1>
          </div>
          <p className="text-muted-foreground">Análise detalhada de custos de IA e projeções de uso</p>
        </div>

        {/* Data Source Banner */}
        <div className={`p-3 rounded-lg mb-6 flex items-center gap-3 ${hasRealData ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}`}>
          {hasRealData ? (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-green-600">Dados reais do sistema ($ {(realCostPer1K * 1000).toFixed(2)}/1M tokens)</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-yellow-600">Usando estimativas - execute análises para dados reais</span>
            </>
          )}
        </div>

        {/* Sub-Tabs */}
        <Tabs defaultValue="custos" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="custos" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Custos Reais
            </TabsTrigger>
            <TabsTrigger value="indicadores" className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" />
              Indicadores
            </TabsTrigger>
            <TabsTrigger value="comparativos" className="flex items-center gap-2">
              <GitCompare className="w-4 h-4" />
              Comparativos
            </TabsTrigger>
            <TabsTrigger value="indicacao" className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Indicação
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Custos Reais */}
          <TabsContent value="custos" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-card border border-border rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">R$ {(stats?.estimatedTotalCost! * USD_TO_BRL).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Custo Total</p>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-card border border-border rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <Calculator className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">R$ {(stats?.avgCostPerAnalysis! * USD_TO_BRL).toFixed(4)}</p>
                    <p className="text-xs text-muted-foreground">Custo/Análise</p>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-card border border-border rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{stats?.totalTokens.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Tokens</p>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-card border border-border rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">R$ {(monthlyProjectedCost * USD_TO_BRL).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Projeção Mensal</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Model Usage Table - All models with real data */}
            <div className="p-6 bg-card border border-border rounded-xl">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Custo por Modelo de IA (Dados Reais)
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30 ml-2">
                  Mediana Aparada (±15%)
                </Badge>
              </h3>
              {modelUsageStats.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum dado de uso encontrado. Execute análises para ver dados reais.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2">Provider</th>
                        <th className="text-left py-3 px-2">Modelo</th>
                        <th className="text-center py-3 px-2">Tipo</th>
                        <th className="text-right py-3 px-2">Análises</th>
                        <th className="text-right py-3 px-2">Tokens Médios</th>
                        <th className="text-right py-3 px-2">Custo Médio</th>
                        <th className="text-right py-3 px-2">Custo Total</th>
                        <th className="text-center py-3 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelUsageStats.map((m) => (
                        <tr key={m.modelKey} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-3 px-2">
                            <Badge className={m.provider === 'OpenAI' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}>
                              {m.provider === 'OpenAI' ? '🔵' : '🟢'} {m.provider}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 font-mono text-xs">{m.modelName}</td>
                          <td className="py-3 px-2 text-center">
                            <Badge className={m.isEconomic ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}>
                              {m.isEconomic ? <><Leaf className="w-3 h-3 mr-1" /> Eco</> : <><Flame className="w-3 h-3 mr-1" /> Std</>}
                            </Badge>
                          </td>
                          <td className="text-right py-3 px-2">{m.count}</td>
                          <td className="text-right py-3 px-2 font-mono">{m.avgTokens.toLocaleString()}</td>
                          <td className="text-right py-3 px-2">R$ {(m.avgCost * USD_TO_BRL).toFixed(4)}</td>
                          <td className="text-right py-3 px-2 font-medium">R$ {(m.totalCost * USD_TO_BRL).toFixed(2)}</td>
                          <td className="text-center py-3 px-2">
                            <div className="flex items-center justify-center gap-1">
                              {m.hasOutliers && (
                                <span title={`${m.outlierCount} outlier(s) filtrado(s)`} className="cursor-help">
                                  <Badge className="bg-amber-500/10 text-amber-500 text-xs">
                                    ⚠️ {m.outlierCount}
                                  </Badge>
                                </span>
                              )}
                              {m.dataQuality && (
                                <span title={m.dataQuality.label} className={`text-xs ${m.dataQuality.color} cursor-help`}>
                                  {m.dataQuality.icon}
                                </span>
                              )}
                              {!m.hasOutliers && !m.dataQuality && m.count >= 10 && (
                                <Badge className="bg-green-500/10 text-green-500 text-xs">✓</Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {/* Total row */}
                      <tr className="border-t-2 border-border font-semibold bg-muted/20">
                        <td colSpan={3} className="py-3 px-2">TOTAL</td>
                        <td className="text-right py-3 px-2">{modelUsageStats.reduce((sum, m) => sum + m.count, 0)}</td>
                        <td className="text-right py-3 px-2 font-mono">
                          {Math.round(modelUsageStats.reduce((sum, m) => sum + m.avgTokens * m.count, 0) / modelUsageStats.reduce((sum, m) => sum + m.count, 0) || 0).toLocaleString()}
                        </td>
                        <td className="text-right py-3 px-2">
                          R$ {((modelUsageStats.reduce((sum, m) => sum + m.totalCost, 0) / modelUsageStats.reduce((sum, m) => sum + m.count, 0) || 0) * USD_TO_BRL).toFixed(4)}
                        </td>
                        <td className="text-right py-3 px-2">R$ {(modelUsageStats.reduce((sum, m) => sum + m.totalCost, 0) * USD_TO_BRL).toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Depth Cost Estimation - Dynamic Models */}
            <div className="p-6 bg-card border border-border rounded-xl">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-500" />
                Estimativa por Profundidade (Todos os Modelos)
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30 ml-2">
                  Mediana Aparada
                </Badge>
                <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1 cursor-help" title="Custo estimado POR ANÁLISE baseado na mediana de tokens reais × custo/1K do modelo específico">
                  <Info className="w-3 h-3" />
                  por análise
                </span>
              </h3>
              
              {/* Explicação detalhada do cálculo */}
              <div className="p-3 mb-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>Como é calculado:</strong> Custo = (Tokens da Profundidade ÷ 1M) × Custo/1M do Modelo</p>
                    <p><strong>Tokens por profundidade:</strong> Mediana real de todas as análises dessa profundidade (independente do modelo usado)</p>
                    <p><strong>Custo/1M por modelo:</strong> Custo médio real do modelo no sistema (ou referência se sem dados)</p>
                  </div>
                </div>
              </div>
              
              {/* Nota sobre diferença de custos entre providers */}
              <div className="p-3 mb-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    <p><strong>Por que OpenAI nano/mini são mais baratos?</strong></p>
                    <p>Modelos como GPT-5 Nano ($0.05/1M input) e GPT-4o Mini ($0.15/1M input) são 7-50x mais baratos que modelos padrão como GPT-5 ($1.25/1M) ou Gemini 2.5 Pro. A qualidade varia proporcionalmente - escolha baseado no caso de uso.</p>
                  </div>
                </div>
              </div>
              
              {/* Depth Stats Quality Indicators */}
              {depthStats.some(d => d.hasOutliers || d.dataQuality) && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-600 font-medium">Alertas de Qualidade de Dados:</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {depthStats.map(d => {
                      if (!d.hasOutliers && !d.dataQuality) return null;
                      return (
                        <li key={d.depth} className="flex items-center gap-2">
                          <Badge className={d.depth === 'critical' ? 'bg-green-500/10 text-green-500 text-xs' : d.depth === 'balanced' ? 'bg-blue-500/10 text-blue-500 text-xs' : 'bg-purple-500/10 text-purple-500 text-xs'}>
                            {d.depth}
                          </Badge>
                          {d.hasOutliers && (
                            <span className="text-amber-500">⚠️ {d.outlierCount} outlier(s) filtrado(s)</span>
                          )}
                          {d.dataQuality && (
                            <span className={d.dataQuality.color}>{d.dataQuality.label}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {depthModelEstimations.models.length === 0 ? (
                <p className="text-muted-foreground text-sm">Execute análises para ver estimativas por modelo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2">Profundidade</th>
                        <th className="text-right py-3 px-2">
                          <span className="flex items-center justify-end gap-1 cursor-help" title="Mediana de tokens reais para esta profundidade (independente do modelo)">
                            Tokens <Info className="w-3 h-3 text-muted-foreground" />
                          </span>
                        </th>
                        <th className="text-center py-3 px-2">Amostras</th>
                        <th className="text-center py-3 px-2">Status</th>
                        {depthModelEstimations.models.map(model => (
                          <th key={model.key} className="text-right py-3 px-2">
                            <div className="flex items-center justify-end gap-1">
                              <Badge className={model.provider === 'OpenAI' ? 'bg-blue-500/10 text-blue-500 text-[10px]' : 'bg-green-500/10 text-green-500 text-[10px]'}>
                                {model.provider === 'OpenAI' ? '🔵' : '🟢'}
                              </Badge>
                              <span className="text-xs">{model.name}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {depthModelEstimations.data.map((row) => {
                        const depthInfo = depthModelEstimations.depths.find(d => d.depth === row.depth);
                        const depthStat = depthStats.find(d => d.depth === row.depth);
                        const sampleCount = depthStat?.count || 0;
                        return (
                          <tr key={row.depth} className="border-b border-border/50">
                            <td className="py-3 px-2">
                              <Badge className={row.depth === 'critical' ? 'bg-green-500/10 text-green-500' : row.depth === 'balanced' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}>
                                {depthInfo?.label}
                              </Badge>
                            </td>
                            <td className="text-right py-3 px-2 font-mono text-xs">{row.tokens.toLocaleString()}</td>
                            <td className="text-center py-3 px-2">
                              <span className={`text-xs ${sampleCount < 5 ? 'text-red-500' : sampleCount < 10 ? 'text-amber-500' : 'text-green-500'}`}>
                                {sampleCount > 0 ? sampleCount : '-'}
                              </span>
                            </td>
                            <td className="text-center py-3 px-2">
                              <div className="flex items-center justify-center gap-1">
                                {depthStat?.hasOutliers && (
                                  <span title={`${depthStat.outlierCount} outlier(s)`} className="cursor-help">
                                    <Badge className="bg-amber-500/10 text-amber-500 text-xs">⚠️</Badge>
                                  </span>
                                )}
                                {depthStat?.dataQuality && (
                                  <span title={depthStat.dataQuality.label} className={`text-xs ${depthStat.dataQuality.color} cursor-help`}>
                                    {depthStat.dataQuality.icon}
                                  </span>
                                )}
                                {!depthStat?.hasOutliers && !depthStat?.dataQuality && depthStat && depthStat.count >= 10 && (
                                  <Badge className="bg-green-500/10 text-green-500 text-xs">✓</Badge>
                                )}
                                {(!depthStat || depthStat.count === 0) && (
                                  <span className="text-xs text-muted-foreground">(est.)</span>
                                )}
                              </div>
                            </td>
                            {depthModelEstimations.models.map(model => (
                              <td key={model.key} className={`text-right py-3 px-2 font-medium ${model.isEconomic ? 'text-green-500' : 'text-orange-500'}`}>
                                R$ {(row.costs[model.key] || 0).toFixed(4)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                      {/* Economia row */}
                      {depthModelEstimations.models.length > 1 && (
                        <tr className="border-t-2 border-border bg-muted/20">
                          <td colSpan={4} className="py-3 px-2 font-medium">Economia vs mais caro</td>
                          {depthModelEstimations.models.map((model, idx) => {
                            if (depthModelEstimations.data.length === 0) return <td key={model.key}>-</td>;
                            const avgCost = depthModelEstimations.data.reduce((sum, row) => sum + (row.costs[model.key] || 0), 0) / depthModelEstimations.data.length;
                            const maxCost = Math.max(...depthModelEstimations.models.map(m => 
                              depthModelEstimations.data.reduce((sum, row) => sum + (row.costs[m.key] || 0), 0) / depthModelEstimations.data.length
                            ));
                            const savings = maxCost > 0 ? ((maxCost - avgCost) / maxCost) * 100 : 0;
                            return (
                              <td key={model.key} className="text-right py-3 px-2">
                                {savings > 0 ? (
                                  <Badge className="bg-green-500/10 text-green-500">{savings.toFixed(0)}%</Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Charts Grid */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="p-6 bg-card border border-border rounded-xl">
                <h3 className="font-semibold text-lg mb-4">Uso Diário (14 dias)</h3>
                <div className="h-64">
                  {dailyUsage.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyUsage}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" className="text-muted-foreground text-xs" />
                        <YAxis className="text-muted-foreground text-xs" />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                        <Bar dataKey="analyses" fill="hsl(var(--primary))" name="Análises" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-muted-foreground">Sem dados</div>}
                </div>
              </div>

              <div className="p-6 bg-card border border-border rounded-xl">
                <h3 className="font-semibold text-lg mb-4">Custo Acumulado (R$)</h3>
                <div className="h-64">
                  {dailyUsage.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyUsage.reduce((acc, d, i) => {
                        const prevCumulative = i > 0 ? acc[i - 1].cumulative : 0;
                        acc.push({ ...d, cumulative: prevCumulative + d.cost });
                        return acc;
                      }, [] as (DailyUsage & { cumulative: number })[])}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" className="text-muted-foreground text-xs" />
                        <YAxis className="text-muted-foreground text-xs" tickFormatter={(v) => `R$${(v * USD_TO_BRL).toFixed(2)}`} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number) => [`R$ ${(value * USD_TO_BRL).toFixed(4)}`, 'Acumulado']} />
                        <Line type="monotone" dataKey="cumulative" stroke="hsl(142, 76%, 36%)" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-muted-foreground">Sem dados</div>}
                </div>
              </div>

              <div className="p-6 bg-card border border-border rounded-xl">
                <h3 className="font-semibold text-lg mb-4">Custo Diário (R$)</h3>
                <div className="h-64">
                  {dailyUsage.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyUsage}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" className="text-muted-foreground text-xs" />
                        <YAxis className="text-muted-foreground text-xs" tickFormatter={(v) => `R$${(v * USD_TO_BRL).toFixed(2)}`} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number) => [`R$ ${(value * USD_TO_BRL).toFixed(4)}`, 'Custo']} />
                        <Line type="monotone" dataKey="cost" stroke="hsl(var(--primary))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-muted-foreground">Sem dados</div>}
                </div>
              </div>

              <div className="p-6 bg-card border border-border rounded-xl">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-500" />
                  Evolução de Tokens
                </h3>
                <div className="h-64">
                  {dailyUsage.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyUsage}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" className="text-muted-foreground text-xs" />
                        <YAxis className="text-muted-foreground text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number) => [`${value.toLocaleString()} tokens`, 'Tokens']} />
                        <Bar dataKey="tokens" fill="hsl(262, 83%, 58%)" name="Tokens" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-muted-foreground">Sem dados</div>}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Indicadores */}
          <TabsContent value="indicadores" className="space-y-6">
            {/* Top 10 Models */}
            <div className="p-6 bg-card border border-border rounded-xl">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Top 10 Modelos Mais Baratos
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2">#</th>
                      <th className="text-left py-3 px-2">Provider</th>
                      <th className="text-left py-3 px-2">Modelo</th>
                      <th className="text-right py-3 px-2">Custo/1M</th>
                      <th className="text-right py-3 px-2">10 Análises</th>
                      <th className="text-right py-3 px-2">100 Análises</th>
                      <th className="text-right py-3 px-2">Economia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_MODELS.slice(0, 10).map((model, index) => {
                      const tokensPerAnalysis = 15000;
                      const costPer10 = (tokensPerAnalysis * 10 / 1000) * model.costPer1K;
                      const costPer100 = (tokensPerAnalysis * 100 / 1000) * model.costPer1K;
                      const maxCost = ALL_MODELS[ALL_MODELS.length - 1].costPer1K;
                      const savings = ((maxCost - model.costPer1K) / maxCost) * 100;
                      const costPer1M = model.costPer1K * 1000;
                      
                      return (
                        <tr key={`${model.provider}-${model.name}`} className={`border-b border-border/50 ${index < 3 ? 'bg-yellow-500/5' : ''}`}>
                          <td className="py-3 px-2 text-center">
                            {index < 3 ? <span className="text-lg">{RANKING_BADGES[index]}</span> : <span className="text-muted-foreground">{index + 1}</span>}
                          </td>
                          <td className="py-3 px-2">
                            <Badge variant="outline" className={model.provider === 'Lovable AI' ? 'border-purple-500/50 text-purple-500' : 'border-blue-500/50 text-blue-500'}>
                              {model.provider}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 font-medium">{model.name}</td>
                          <td className="text-right py-3 px-2 font-mono">${costPer1M.toFixed(2)}</td>
                          <td className="text-right py-3 px-2">
                            <div className="flex flex-col items-end">
                              <span className="font-medium">${costPer10.toFixed(3)}</span>
                              <span className="text-xs text-muted-foreground">R$ {(costPer10 * USD_TO_BRL).toFixed(2)}</span>
                            </div>
                          </td>
                          <td className="text-right py-3 px-2">
                            <div className="flex flex-col items-end">
                              <span className="font-medium">${costPer100.toFixed(2)}</span>
                              <span className="text-xs text-muted-foreground">R$ {(costPer100 * USD_TO_BRL).toFixed(2)}</span>
                            </div>
                          </td>
                          <td className="text-right py-3 px-2">
                            <Badge className={savings > 80 ? 'bg-green-500/10 text-green-500' : savings > 50 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-muted text-muted-foreground'}>
                              {savings.toFixed(0)}%
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Best Models Summary - Separated by Provider */}
              <div className="grid md:grid-cols-2 gap-6 mt-6">
                {/* Lovable AI */}
                <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">🟢</span>
                    <span className="font-semibold text-green-600">Lovable AI</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-background/50 rounded-lg">
                      <div className="flex items-center gap-1 mb-1">
                        <Leaf className="w-3 h-3 text-green-500" />
                        <span className="text-xs text-muted-foreground">Mais Econômico</span>
                      </div>
                      <p className="font-bold text-sm">{ALL_MODELS.filter(m => m.provider === 'Lovable AI').sort((a, b) => a.costPer1K - b.costPer1K)[0]?.name || 'N/A'}</p>
                      <p className="text-xs text-green-500">${((ALL_MODELS.filter(m => m.provider === 'Lovable AI').sort((a, b) => a.costPer1K - b.costPer1K)[0]?.costPer1K || 0) * 1000).toFixed(2)}/1M</p>
                    </div>
                    <div className="p-3 bg-background/50 rounded-lg">
                      <div className="flex items-center gap-1 mb-1">
                        <Scale className="w-3 h-3 text-purple-500" />
                        <span className="text-xs text-muted-foreground">Custo-Benefício</span>
                      </div>
                      {(() => {
                        const lovableModels = ALL_MODELS.filter(m => m.provider === 'Lovable AI').sort((a, b) => a.costPer1K - b.costPer1K);
                        // Best cost-benefit: middle model (not cheapest, not most expensive)
                        const bestCB = lovableModels.length > 2 ? lovableModels[Math.floor(lovableModels.length / 2)] : lovableModels[0];
                        return bestCB ? (
                          <>
                            <p className="font-bold text-sm">{bestCB.name}</p>
                            <p className="text-xs text-purple-500">${(bestCB.costPer1K * 1000).toFixed(2)}/1M</p>
                          </>
                        ) : <p className="text-sm text-muted-foreground">N/A</p>;
                      })()}
                    </div>
                  </div>
                </div>
                
                {/* OpenAI */}
                <div className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">🔵</span>
                    <span className="font-semibold text-blue-600">OpenAI</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-background/50 rounded-lg">
                      <div className="flex items-center gap-1 mb-1">
                        <Leaf className="w-3 h-3 text-green-500" />
                        <span className="text-xs text-muted-foreground">Mais Econômico</span>
                      </div>
                      <p className="font-bold text-sm">{ALL_MODELS.filter(m => m.provider === 'OpenAI').sort((a, b) => a.costPer1K - b.costPer1K)[0]?.name || 'N/A'}</p>
                      <p className="text-xs text-green-500">${((ALL_MODELS.filter(m => m.provider === 'OpenAI').sort((a, b) => a.costPer1K - b.costPer1K)[0]?.costPer1K || 0) * 1000).toFixed(2)}/1M</p>
                    </div>
                    <div className="p-3 bg-background/50 rounded-lg">
                      <div className="flex items-center gap-1 mb-1">
                        <Scale className="w-3 h-3 text-purple-500" />
                        <span className="text-xs text-muted-foreground">Custo-Benefício</span>
                      </div>
                      {(() => {
                        const openaiModels = ALL_MODELS.filter(m => m.provider === 'OpenAI').sort((a, b) => a.costPer1K - b.costPer1K);
                        // Best cost-benefit: middle model (not cheapest, not most expensive)
                        const bestCB = openaiModels.length > 2 ? openaiModels[Math.floor(openaiModels.length / 2)] : openaiModels[0];
                        return bestCB ? (
                          <>
                            <p className="font-bold text-sm">{bestCB.name}</p>
                            <p className="text-xs text-purple-500">${(bestCB.costPer1K * 1000).toFixed(2)}/1M</p>
                          </>
                        ) : <p className="text-sm text-muted-foreground">N/A</p>;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Distribution Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="p-6 bg-card border border-border rounded-xl">
                <h3 className="font-semibold text-lg mb-4">Distribuição por Modo</h3>
                {modePieData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={modePieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} dataKey="value">
                          {modePieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="h-64 flex items-center justify-center text-muted-foreground">Sem dados</div>}
              </div>

              <div className="p-6 bg-card border border-border rounded-xl">
                <h3 className="font-semibold text-lg mb-4">Distribuição por Profundidade</h3>
                {depthPieData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={depthPieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} dataKey="value">
                          {depthPieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="h-64 flex items-center justify-center text-muted-foreground">Sem dados</div>}
              </div>
            </div>

            {/* Top Users */}
            <div className="p-6 bg-card border border-border rounded-xl">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Top 10 Usuários por Custo
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead className="text-center">Plano</TableHead>
                    <TableHead className="text-right">Análises</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Custo (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userCosts.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum dado de uso registrado</TableCell></TableRow>
                  ) : (
                    userCosts.map((user, index) => (
                      <TableRow key={user.userId}>
                        <TableCell><div className="flex items-center gap-2"><span className="text-muted-foreground">#{index + 1}</span><span className="font-medium">{user.email}</span></div></TableCell>
                        <TableCell className="text-center">
                          <Badge className={user.planName === 'Pro' ? 'bg-purple-500/10 text-purple-500' : user.planName === 'Basic' ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground'}>{user.planName}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{user.analysesCount}</TableCell>
                        <TableCell className="text-right font-mono">{user.totalTokens.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">R$ {(user.estimatedCost * USD_TO_BRL).toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB 3: Comparativos */}
          <TabsContent value="comparativos" className="space-y-6">
            {/* ROI by Plan - Dynamic from DB */}
            <div className="p-6 bg-card border border-border rounded-xl">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                ROI por Plano (Dados Reais)
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map(plan => {
                  const maxTokens = plan.max_tokens_monthly || 50000;
                  const estimatedCostBRL = (maxTokens / 1000) * realCostPer1K;
                  const revenue = plan.price_monthly;
                  const margin = revenue > 0 ? ((revenue - estimatedCostBRL) / revenue) * 100 : -100;
                  const isProfitable = margin > 0;
                  
                  return (
                    <div key={plan.id} className={`p-4 rounded-lg border ${isProfitable ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <Badge className={plan.slug === 'pro' ? 'bg-purple-500/10 text-purple-500' : plan.slug === 'basic' ? 'bg-blue-500/10 text-blue-500' : plan.slug === 'starter' ? 'bg-orange-500/10 text-orange-500' : 'bg-muted text-muted-foreground'}>
                          {plan.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">R$ {plan.price_monthly.toFixed(2)}/mês</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Receita:</span>
                          <span className="font-medium text-green-500">R$ {revenue.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Custo máx ({(maxTokens/1000).toFixed(0)}K tokens):</span>
                          <span className="font-medium">-R$ {estimatedCostBRL.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-border pt-2 flex justify-between">
                          <span className="text-muted-foreground">Margem:</span>
                          <span className={`font-bold ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
                            {margin.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Alerts */}
              <div className="space-y-2 mt-4">
                {plans.filter(p => {
                  const maxTokens = p.max_tokens_monthly || 50000;
                  const estimatedCostBRL = (maxTokens / 1000) * realCostPer1K;
                  return p.price_monthly > 0 && estimatedCostBRL > p.price_monthly;
                }).map(p => (
                  <div key={p.id} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-600">Plano {p.name} não é lucrativo</p>
                      <p className="text-xs text-muted-foreground">Considere aumentar o preço ou reduzir o limite de tokens.</p>
                    </div>
                  </div>
                ))}

                {potentialSavings > 0.5 && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
                    <Leaf className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-600">Economia potencial: R$ {(potentialSavings * USD_TO_BRL).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Se todas as análises detalhadas usassem modo econômico.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Analysis Type Breakdown */}
            <div className="p-6 bg-card border border-border rounded-xl">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                Custo por Tipo de Análise
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2">Tipo</th>
                      <th className="text-right py-3 px-2"><Flame className="w-3 h-3 text-orange-500 inline mr-1" />Detalhado</th>
                      <th className="text-right py-3 px-2"><Leaf className="w-3 h-3 text-green-500 inline mr-1" />Econômico</th>
                      <th className="text-right py-3 px-2">Custo Det.</th>
                      <th className="text-right py-3 px-2">Custo Eco.</th>
                      <th className="text-right py-3 px-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisTypeStats.map((t) => (
                      <tr key={t.type} className="border-b border-border/50">
                        <td className="py-3 px-2 font-medium">{ANALYSIS_TYPES_PT[t.type] || t.type}</td>
                        <td className="text-right py-3 px-2">{t.detailedCount}</td>
                        <td className="text-right py-3 px-2">{t.economicCount}</td>
                        <td className="text-right py-3 px-2 text-orange-500">R$ {(t.detailedCost * USD_TO_BRL).toFixed(4)}</td>
                        <td className="text-right py-3 px-2 text-green-500">R$ {(t.economicCost * USD_TO_BRL).toFixed(4)}</td>
                        <td className="text-right py-3 px-2 font-medium">R$ {(t.totalCost * USD_TO_BRL).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Growth Projections */}
            <div className="p-6 bg-card border border-border rounded-xl">
              <h3 className="font-semibold text-lg mb-4">Projeções de Crescimento</h3>
              <div className="grid md:grid-cols-3 gap-4">
                {[100, 500, 1000].map(users => {
                  const avgAnalysesPerUser = 5;
                  const avgTypesPerAnalysis = 7;
                  const costPerUser = avgAnalysesPerUser * avgTypesPerAnalysis * (stats?.avgCostPerAnalysis || 0) * USD_TO_BRL;
                  const totalCost = users * costPerUser;
                  return (
                    <div key={users} className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Com {users} usuários/mês</p>
                      <p className="text-xl font-bold">R$ {totalCost.toFixed(2)}/mês</p>
                      <p className="text-xs text-muted-foreground">~{avgAnalysesPerUser} projetos × {avgTypesPerAnalysis} análises</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* TAB 4: Indicação do Sistema */}
          <TabsContent value="indicacao" className="space-y-6">
            <SystemRecommendationTab 
              modelUsageStats={modelUsageStats} 
              depthStats={depthStats}
              hasRealData={hasRealData}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminCosts;
