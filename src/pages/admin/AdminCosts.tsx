import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Github, 
  Home, 
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
  GitCompare
} from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/useAdmin";
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
}

interface ModeStats {
  mode: 'detailed' | 'economic';
  modelName: string;
  count: number;
  avgTokens: number;
  avgCost: number;
  totalCost: number;
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

const USD_TO_BRL = 5.5;
const COST_PER_ANALYSIS = 0.002;

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

const ALL_MODELS = [
  { provider: 'Lovable AI', name: 'Gemini 2.5 Flash Lite', inputPer1M: 0.075, outputPer1M: 0.30, costPer1K: 0.000375 },
  { provider: 'Lovable AI', name: 'Gemini 2.5 Flash', inputPer1M: 0.15, outputPer1M: 0.60, costPer1K: 0.00075 },
  { provider: 'Lovable AI', name: 'Gemini 2.5 Pro', inputPer1M: 1.25, outputPer1M: 10.00, costPer1K: 0.01125 },
  { provider: 'OpenAI', name: 'GPT-5 Nano', inputPer1M: 0.05, outputPer1M: 0.40, costPer1K: 0.00045 },
  { provider: 'OpenAI', name: 'GPT-4.1 Nano', inputPer1M: 0.10, outputPer1M: 0.40, costPer1K: 0.0005 },
  { provider: 'OpenAI', name: 'GPT-4o Mini', inputPer1M: 0.15, outputPer1M: 0.60, costPer1K: 0.00075 },
  { provider: 'OpenAI', name: 'GPT-5 Mini', inputPer1M: 0.25, outputPer1M: 2.00, costPer1K: 0.00225 },
  { provider: 'OpenAI', name: 'GPT-4.1 Mini', inputPer1M: 0.40, outputPer1M: 1.60, costPer1K: 0.002 },
  { provider: 'OpenAI', name: 'O4 Mini', inputPer1M: 1.10, outputPer1M: 4.40, costPer1K: 0.0055 },
  { provider: 'OpenAI', name: 'O3', inputPer1M: 2.00, outputPer1M: 8.00, costPer1K: 0.01 },
  { provider: 'OpenAI', name: 'GPT-4.1', inputPer1M: 2.00, outputPer1M: 8.00, costPer1K: 0.01 },
  { provider: 'OpenAI', name: 'GPT-5', inputPer1M: 1.25, outputPer1M: 10.00, costPer1K: 0.01125 },
  { provider: 'OpenAI', name: 'GPT-4o', inputPer1M: 2.50, outputPer1M: 10.00, costPer1K: 0.0125 },
].sort((a, b) => a.costPer1K - b.costPer1K);

const RANKING_BADGES = ['🥇', '🥈', '🥉'];

const AdminCosts = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [stats, setStats] = useState<CostStats | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [userCosts, setUserCosts] = useState<UserCost[]>([]);
  const [depthStats, setDepthStats] = useState<DepthStats[]>([]);
  const [modeStats, setModeStats] = useState<ModeStats[]>([]);
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

      // Get real usage data
      const { data: usageData } = await supabase
        .from("analysis_usage")
        .select("*");

      const realTotalCost = usageData?.reduce((sum, u) => sum + Number(u.cost_estimated || 0), 0) || 0;
      const realTotalTokens = usageData?.reduce((sum, u) => sum + (u.tokens_estimated || 0), 0) || 0;

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

      const hasRealUsageData = usageData && usageData.length > 0;
      setHasRealData(hasRealUsageData);
      
      const estimatedTotalCost = hasRealUsageData ? realTotalCost : (totalAnalyses || 0) * COST_PER_ANALYSIS;
      const avgCostPerAnalysis = totalAnalyses && totalAnalyses > 0 
        ? estimatedTotalCost / totalAnalyses 
        : COST_PER_ANALYSIS;
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

      // Mode statistics
      const modeMap = new Map<string, { count: number; tokens: number; cost: number }>();
      usageData?.forEach(u => {
        const isEconomic = u.model_used?.includes('lite');
        const mode = isEconomic ? 'economic' : 'detailed';
        const existing = modeMap.get(mode) || { count: 0, tokens: 0, cost: 0 };
        modeMap.set(mode, {
          count: existing.count + 1,
          tokens: existing.tokens + (u.tokens_estimated || 0),
          cost: existing.cost + Number(u.cost_estimated || 0),
        });
      });

      const modeStatsData: ModeStats[] = [
        { 
          mode: 'detailed', 
          modelName: 'gemini-2.5-flash',
          count: modeMap.get('detailed')?.count || 0, 
          avgTokens: modeMap.get('detailed')?.count ? Math.round((modeMap.get('detailed')?.tokens || 0) / modeMap.get('detailed')!.count) : 0,
          avgCost: modeMap.get('detailed')?.count ? (modeMap.get('detailed')?.cost || 0) / modeMap.get('detailed')!.count : 0,
          totalCost: modeMap.get('detailed')?.cost || 0,
        },
        { 
          mode: 'economic', 
          modelName: 'gemini-2.5-flash-lite',
          count: modeMap.get('economic')?.count || 0, 
          avgTokens: modeMap.get('economic')?.count ? Math.round((modeMap.get('economic')?.tokens || 0) / modeMap.get('economic')!.count) : 0,
          avgCost: modeMap.get('economic')?.count ? (modeMap.get('economic')?.cost || 0) / modeMap.get('economic')!.count : 0,
          totalCost: modeMap.get('economic')?.cost || 0,
        },
      ];
      setModeStats(modeStatsData);

      // Depth statistics
      const depthMap = new Map<string, { count: number; tokens: number; cost: number }>();
      usageData?.forEach(u => {
        const depth = u.depth_level || 'complete';
        const existing = depthMap.get(depth) || { count: 0, tokens: 0, cost: 0 };
        depthMap.set(depth, {
          count: existing.count + 1,
          tokens: existing.tokens + (u.tokens_estimated || 0),
          cost: existing.cost + Number(u.cost_estimated || 0),
        });
      });

      const depthStatsData: DepthStats[] = ['critical', 'balanced', 'complete'].map(d => {
        const data = depthMap.get(d);
        if (data && data.count > 0) {
          return {
            depth: d,
            count: data.count,
            avgTokens: Math.round(data.tokens / data.count),
            avgCost: data.cost / data.count,
            totalCost: data.cost,
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

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const dailyAvg = dailyUsage.length > 0 
    ? dailyUsage.reduce((sum, d) => sum + d.analyses, 0) / dailyUsage.length 
    : 0;
  const monthlyProjection = dailyAvg * 30;
  const monthlyProjectedCost = stats ? (stats.avgCostPerAnalysis * monthlyProjection) : 0;

  const modePieData = modeStats.filter(m => m.count > 0).map(m => ({
    name: m.mode === 'detailed' ? 'Detalhado' : 'Econômico',
    value: m.count,
    color: MODE_COLORS[m.mode],
  }));

  const depthPieData = depthStats.filter(d => d.count > 0).map(d => ({
    name: d.depth.charAt(0).toUpperCase() + d.depth.slice(1),
    value: d.count,
    color: DEPTH_COLORS[d.depth as keyof typeof DEPTH_COLORS],
  }));

  const totalDetailedAnalyses = modeStats.find(m => m.mode === 'detailed')?.count || 0;
  const avgDetailedCost = modeStats.find(m => m.mode === 'detailed')?.avgCost || 0;
  const potentialSavings = totalDetailedAnalyses * avgDetailedCost * 0.8;

  const depthEstimations = [
    { depth: 'Critical', tokens: 10000, contextLabel: '10K' },
    { depth: 'Balanced', tokens: 15000, contextLabel: '15K' },
    { depth: 'Complete', tokens: 20000, contextLabel: '20K' },
  ];

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
              <Home className="w-4 h-4 mr-2" />
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
              <span className="text-sm text-green-600">Dados reais do sistema (R$ {realCostPer1K.toFixed(4)}/1K tokens)</span>
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
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
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

            {/* Mode Comparison Table */}
            <div className="p-6 bg-card border border-border rounded-xl">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Custo por Modo de Análise
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2">Modo</th>
                      <th className="text-left py-3 px-2">Modelo</th>
                      <th className="text-right py-3 px-2">Análises</th>
                      <th className="text-right py-3 px-2">Tokens Médios</th>
                      <th className="text-right py-3 px-2">Custo Médio</th>
                      <th className="text-right py-3 px-2">Custo Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modeStats.map((m) => (
                      <tr key={m.mode} className="border-b border-border/50">
                        <td className="py-3 px-2">
                          <Badge className={m.mode === 'detailed' ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'}>
                            {m.mode === 'detailed' ? <><Flame className="w-3 h-3 mr-1" /> Detalhado</> : <><Leaf className="w-3 h-3 mr-1" /> Econômico</>}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 font-mono text-xs text-muted-foreground">{m.modelName}</td>
                        <td className="text-right py-3 px-2">{m.count}</td>
                        <td className="text-right py-3 px-2 font-mono">{m.avgTokens.toLocaleString()}</td>
                        <td className="text-right py-3 px-2">R$ {(m.avgCost * USD_TO_BRL).toFixed(4)}</td>
                        <td className="text-right py-3 px-2 font-medium">R$ {(m.totalCost * USD_TO_BRL).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Depth Cost Estimation */}
            <div className="p-6 bg-card border border-border rounded-xl">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-500" />
                Estimativa por Profundidade
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Baseado em custo real: R$ {realCostPer1K.toFixed(4)}/1K tokens
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2">Profundidade</th>
                      <th className="text-right py-3 px-2">Contexto</th>
                      <th className="text-right py-3 px-2"><Flame className="w-3 h-3 text-orange-500 inline mr-1" />Flash</th>
                      <th className="text-right py-3 px-2"><Leaf className="w-3 h-3 text-green-500 inline mr-1" />Flash-Lite</th>
                      <th className="text-right py-3 px-2">Economia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depthEstimations.map((d) => {
                      const flashCost = (d.tokens / 1000) * realCostPer1K;
                      const liteCost = flashCost * 0.2;
                      return (
                        <tr key={d.depth} className="border-b border-border/50">
                          <td className="py-3 px-2">
                            <Badge className={d.depth === 'Critical' ? 'bg-green-500/10 text-green-500' : d.depth === 'Balanced' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}>
                              {d.depth}
                            </Badge>
                          </td>
                          <td className="text-right py-3 px-2 font-mono">{d.contextLabel} tokens</td>
                          <td className="text-right py-3 px-2 font-medium text-orange-500">R$ {flashCost.toFixed(4)}</td>
                          <td className="text-right py-3 px-2 font-medium text-green-500">R$ {liteCost.toFixed(4)}</td>
                          <td className="text-right py-3 px-2"><Badge className="bg-green-500/10 text-green-500">80%</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
                      <th className="text-right py-3 px-2">Custo/1K</th>
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
                          <td className="text-right py-3 px-2 font-mono">${model.costPer1K.toFixed(5)}</td>
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
              
              {/* Best Models Summary */}
              <div className="grid md:grid-cols-3 gap-4 mt-6">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2"><span className="text-lg">🥇</span><span className="font-medium text-green-600">Mais Econômico</span></div>
                  <p className="text-lg font-bold">{ALL_MODELS[0].name}</p>
                  <p className="text-sm text-muted-foreground">{ALL_MODELS[0].provider}</p>
                </div>
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-purple-500" /><span className="font-medium text-purple-600">Melhor Lovable AI</span></div>
                  <p className="text-lg font-bold">{ALL_MODELS.filter(m => m.provider === 'Lovable AI').sort((a, b) => a.costPer1K - b.costPer1K)[0]?.name}</p>
                </div>
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2"><Calculator className="w-4 h-4 text-blue-500" /><span className="font-medium text-blue-600">Melhor OpenAI</span></div>
                  <p className="text-lg font-bold">{ALL_MODELS.filter(m => m.provider === 'OpenAI').sort((a, b) => a.costPer1K - b.costPer1K)[0]?.name}</p>
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
                  const costPerUser = avgAnalysesPerUser * avgTypesPerAnalysis * (stats?.avgCostPerAnalysis || COST_PER_ANALYSIS) * USD_TO_BRL;
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
        </Tabs>
      </main>
    </div>
  );
};

export default AdminCosts;
