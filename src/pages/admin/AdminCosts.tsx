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
  Shield,
  ArrowLeft,
  Zap,
  BarChart3,
  Flame,
  Leaf,
  AlertTriangle,
  Trophy
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
  Legend
} from "recharts";
import { Badge } from "@/components/ui/badge";

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
  totalCost: number;
  avgCost: number;
}

const USD_TO_BRL = 5.5;
const COST_PER_ANALYSIS = 0.002;

// Real cost per 1000 tokens based on system data (R$ 0.10 / 18183 tokens = ~R$ 0.0055/1K tokens)
const FLASH_COST_PER_1K_BRL = 0.0055;
const FLASH_LITE_COST_PER_1K_BRL = 0.0011; // ~80% cheaper

const DEPTH_COLORS = {
  'critical': 'hsl(142, 76%, 36%)',
  'balanced': 'hsl(217, 91%, 60%)', 
  'complete': 'hsl(262, 83%, 58%)',
};

const MODE_COLORS = {
  'detailed': 'hsl(25, 95%, 53%)', // orange
  'economic': 'hsl(142, 76%, 36%)', // green
};

const ANALYSIS_TYPES_PT: Record<string, string> = {
  'prd': 'PRD',
  'divulgacao': 'Divulgação',
  'captacao': 'Captação',
  'seguranca': 'Segurança',
  'ui': 'UI/UX',
  'ferramentas': 'Ferramentas',
  'features': 'Novas Features',
  'documentacao': 'Documentação',
};

// All available AI models ranked by cost
const ALL_MODELS = [
  // Lovable AI (Gemini)
  { provider: 'Lovable AI', name: 'Gemini 2.5 Flash Lite', inputPer1M: 0.075, outputPer1M: 0.30, costPer1K: 0.000375 },
  { provider: 'Lovable AI', name: 'Gemini 2.5 Flash', inputPer1M: 0.15, outputPer1M: 0.60, costPer1K: 0.00075 },
  { provider: 'Lovable AI', name: 'Gemini 2.5 Pro', inputPer1M: 1.25, outputPer1M: 10.00, costPer1K: 0.01125 },
  // OpenAI (Standard tier - from official pricing)
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
  const [realCostPer1K, setRealCostPer1K] = useState<number>(FLASH_COST_PER_1K_BRL);

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
      // Get real usage data
      const { data: usageData } = await supabase
        .from("analysis_usage")
        .select("*");

      const realTotalCost = usageData?.reduce((sum, u) => sum + Number(u.cost_estimated || 0), 0) || 0;
      const realTotalTokens = usageData?.reduce((sum, u) => sum + (u.tokens_estimated || 0), 0) || 0;

      // Calculate real cost per 1K tokens
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
        .map(([date, data]) => ({
          date,
          analyses: data.analyses,
          cost: data.cost,
          tokens: data.tokens,
        }))
        .sort((a, b) => {
          const [dayA, monthA] = a.date.split('/').map(Number);
          const [dayB, monthB] = b.date.split('/').map(Number);
          return monthA - monthB || dayA - dayB;
        })
        .slice(-14);

      setDailyUsage(dailyData);

      // Mode statistics (detailed vs economic)
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

      // Depth statistics by depth_level field
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

      const depthStatsData: DepthStats[] = [
        { depth: 'critical', count: 0, avgTokens: 0, avgCost: 0, totalCost: 0 },
        { depth: 'balanced', count: 0, avgTokens: 0, avgCost: 0, totalCost: 0 },
        { depth: 'complete', count: 0, avgTokens: 0, avgCost: 0, totalCost: 0 },
      ].map(d => {
        const data = depthMap.get(d.depth);
        if (data && data.count > 0) {
          return {
            depth: d.depth,
            count: data.count,
            avgTokens: Math.round(data.tokens / data.count),
            avgCost: data.cost / data.count,
            totalCost: data.cost,
          };
        }
        return d;
      });

      setDepthStats(depthStatsData);

      // Analysis type statistics
      const typeMap = new Map<string, { detailedCount: number; economicCount: number; totalCost: number }>();
      
      usageData?.forEach(u => {
        const type = u.analysis_type || 'unknown';
        const isEconomic = u.model_used?.includes('lite');
        
        const existing = typeMap.get(type) || { detailedCount: 0, economicCount: 0, totalCost: 0 };
        typeMap.set(type, {
          detailedCount: existing.detailedCount + (isEconomic ? 0 : 1),
          economicCount: existing.economicCount + (isEconomic ? 1 : 0),
          totalCost: existing.totalCost + Number(u.cost_estimated || 0),
        });
      });

      const typeStatsData: AnalysisTypeStats[] = Array.from(typeMap.entries())
        .map(([type, data]) => ({
          type,
          detailedCount: data.detailedCount,
          economicCount: data.economicCount,
          totalCost: data.totalCost,
          avgCost: data.totalCost / (data.detailedCount + data.economicCount),
        }))
        .sort((a, b) => (b.detailedCount + b.economicCount) - (a.detailedCount + a.economicCount));

      setAnalysisTypeStats(typeStatsData);

      // User costs with profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email");

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

  // Calculate potential savings if all were economic
  const totalDetailedAnalyses = modeStats.find(m => m.mode === 'detailed')?.count || 0;
  const avgDetailedCost = modeStats.find(m => m.mode === 'detailed')?.avgCost || 0;
  const potentialSavings = totalDetailedAnalyses * avgDetailedCost * 0.8; // 80% savings with lite

  // Depth cost estimation table data
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
            <DollarSign className="w-8 h-8 text-green-500" />
            <h1 className="text-3xl font-bold">Custos e Projeções</h1>
          </div>
          <p className="text-muted-foreground">
            Análise detalhada de custos de IA e projeções de uso
          </p>
        </div>

        {/* Data Source Banner */}
        <div className={`p-4 rounded-lg mb-6 flex items-center gap-3 ${hasRealData ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}`}>
          <Shield className={`w-5 h-5 ${hasRealData ? 'text-green-500' : 'text-yellow-500'}`} />
          <div>
            <p className={`font-medium ${hasRealData ? 'text-green-600' : 'text-yellow-600'}`}>
              {hasRealData ? 'Dados Reais de Uso' : 'Dados Estimados'}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasRealData 
                ? `${stats?.totalTokens.toLocaleString()} tokens registrados • ${stats?.totalAnalyses} análises rastreadas • Custo real: R$ ${realCostPer1K.toFixed(4)}/1K tokens`
                : 'Execute análises para ver dados reais de custo.'}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-slide-up">
          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">R$ {(stats?.estimatedTotalCost! * USD_TO_BRL).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">(${stats?.estimatedTotalCost.toFixed(4)} USD)</p>
                <p className="text-sm text-muted-foreground">Custo Total</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Calculator className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">R$ {(stats?.avgCostPerAnalysis! * USD_TO_BRL).toFixed(4)}</p>
                <p className="text-sm text-muted-foreground">Custo/Análise</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalTokens.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Tokens</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">R$ {(monthlyProjectedCost * USD_TO_BRL).toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">Projeção Mensal</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top 10 Cheapest Models Section */}
        <div className="p-6 bg-card border border-border rounded-xl mb-8 animate-slide-up">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Top 10 Modelos Mais Baratos
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Ranking de modelos ordenado por custo (input + output médio). Custos baseados em tier Standard.
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2">#</th>
                  <th className="text-left py-3 px-2">Provider</th>
                  <th className="text-left py-3 px-2">Modelo</th>
                  <th className="text-right py-3 px-2">Input/1M</th>
                  <th className="text-right py-3 px-2">Output/1M</th>
                  <th className="text-right py-3 px-2">Custo/1K</th>
                  <th className="text-right py-3 px-2">10 Análises</th>
                  <th className="text-right py-3 px-2">100 Análises</th>
                  <th className="text-right py-3 px-2">1000 Análises</th>
                  <th className="text-right py-3 px-2">Economia</th>
                </tr>
              </thead>
              <tbody>
                {ALL_MODELS.slice(0, 10).map((model, index) => {
                  const tokensPerAnalysis = 15000; // Average tokens per analysis
                  const costPer10 = (tokensPerAnalysis * 10 / 1000) * model.costPer1K;
                  const costPer100 = (tokensPerAnalysis * 100 / 1000) * model.costPer1K;
                  const costPer1000 = (tokensPerAnalysis * 1000 / 1000) * model.costPer1K;
                  const maxCost = ALL_MODELS[ALL_MODELS.length - 1].costPer1K;
                  const savings = ((maxCost - model.costPer1K) / maxCost) * 100;
                  
                  return (
                    <tr key={`${model.provider}-${model.name}`} className={`border-b border-border/50 ${index < 3 ? 'bg-yellow-500/5' : ''}`}>
                      <td className="py-3 px-2 text-center">
                        {index < 3 ? (
                          <span className="text-lg">{RANKING_BADGES[index]}</span>
                        ) : (
                          <span className="text-muted-foreground">{index + 1}</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <Badge 
                          variant="outline"
                          className={model.provider === 'Lovable AI' 
                            ? 'border-purple-500/50 text-purple-500' 
                            : 'border-blue-500/50 text-blue-500'
                          }
                        >
                          {model.provider}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 font-medium">{model.name}</td>
                      <td className="text-right py-3 px-2 font-mono text-xs text-muted-foreground">
                        ${model.inputPer1M.toFixed(2)}
                      </td>
                      <td className="text-right py-3 px-2 font-mono text-xs text-muted-foreground">
                        ${model.outputPer1M.toFixed(2)}
                      </td>
                      <td className="text-right py-3 px-2 font-mono">
                        ${model.costPer1K.toFixed(5)}
                      </td>
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
                        <div className="flex flex-col items-end">
                          <span className="font-medium">${costPer1000.toFixed(2)}</span>
                          <span className="text-xs text-muted-foreground">R$ {(costPer1000 * USD_TO_BRL).toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2">
                        <Badge 
                          className={savings > 80 
                            ? 'bg-green-500/10 text-green-500' 
                            : savings > 50 
                              ? 'bg-yellow-500/10 text-yellow-500'
                              : 'bg-muted text-muted-foreground'
                          }
                        >
                          {savings.toFixed(0)}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Summary Cards */}
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🥇</span>
                <span className="font-medium text-green-600">Mais Econômico</span>
              </div>
              <p className="text-lg font-bold">{ALL_MODELS[0].name}</p>
              <p className="text-sm text-muted-foreground">{ALL_MODELS[0].provider}</p>
              <p className="text-xs text-green-500 mt-1">${ALL_MODELS[0].costPer1K.toFixed(5)}/1K tokens</p>
            </div>
            
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-purple-500" />
                <span className="font-medium text-purple-600">Melhor Lovable AI</span>
              </div>
              <p className="text-lg font-bold">
                {ALL_MODELS.filter(m => m.provider === 'Lovable AI').sort((a, b) => a.costPer1K - b.costPer1K)[0]?.name}
              </p>
              <p className="text-sm text-muted-foreground">Lovable AI</p>
              <p className="text-xs text-purple-500 mt-1">
                ${ALL_MODELS.filter(m => m.provider === 'Lovable AI').sort((a, b) => a.costPer1K - b.costPer1K)[0]?.costPer1K.toFixed(5)}/1K tokens
              </p>
            </div>
            
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-blue-600">Melhor OpenAI</span>
              </div>
              <p className="text-lg font-bold">
                {ALL_MODELS.filter(m => m.provider === 'OpenAI').sort((a, b) => a.costPer1K - b.costPer1K)[0]?.name}
              </p>
              <p className="text-sm text-muted-foreground">OpenAI</p>
              <p className="text-xs text-blue-500 mt-1">
                ${ALL_MODELS.filter(m => m.provider === 'OpenAI').sort((a, b) => a.costPer1K - b.costPer1K)[0]?.costPer1K.toFixed(5)}/1K tokens
              </p>
            </div>
          </div>
        </div>

        {/* Mode Comparison Section */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="p-6 bg-card border border-border rounded-xl animate-slide-up">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Comparativo por Modo
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
                    <th className="text-right py-3 px-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {modeStats.map((m) => (
                    <tr key={m.mode} className="border-b border-border/50">
                      <td className="py-3 px-2">
                        <Badge 
                          className={`${
                            m.mode === 'detailed' ? 'bg-orange-500/10 text-orange-500' :
                            'bg-green-500/10 text-green-500'
                          }`}
                        >
                          {m.mode === 'detailed' ? (
                            <><Flame className="w-3 h-3 mr-1" /> Detalhado</>
                          ) : (
                            <><Leaf className="w-3 h-3 mr-1" /> Econômico</>
                          )}
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
            
            {/* Potential Savings Card */}
            {potentialSavings > 0 && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Leaf className="w-4 h-4 text-green-500" />
                  <span className="font-medium text-green-600">Economia Potencial</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Se todas as {totalDetailedAnalyses} análises detalhadas fossem econômicas:
                </p>
                <p className="text-xl font-bold text-green-500">
                  R$ {(potentialSavings * USD_TO_BRL).toFixed(2)} economizados (~80%)
                </p>
              </div>
            )}
          </div>

          {/* Mode Pie Chart */}
          <div className="p-6 bg-card border border-border rounded-xl animate-slide-up">
            <h3 className="font-semibold text-lg mb-4">Distribuição por Modo</h3>
            {modePieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modePieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {modePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Execute análises para ver a distribuição
              </div>
            )}
          </div>
        </div>

        {/* Depth Cost Estimation - Both Models */}
        <div className="p-6 bg-card border border-border rounded-xl mb-8 animate-slide-up">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-500" />
            Estimativa de Custos por Profundidade e Modelo
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Baseado em custo real medido: R$ {realCostPer1K.toFixed(4)}/1K tokens (Flash) • Flash-Lite ~80% mais barato
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2">Profundidade</th>
                  <th className="text-right py-3 px-2">Contexto</th>
                  <th className="text-right py-3 px-2">
                    <div className="flex items-center justify-end gap-1">
                      <Flame className="w-3 h-3 text-orange-500" />
                      <span>Flash (Detalhado)</span>
                    </div>
                  </th>
                  <th className="text-right py-3 px-2">
                    <div className="flex items-center justify-end gap-1">
                      <Leaf className="w-3 h-3 text-green-500" />
                      <span>Flash-Lite (Econômico)</span>
                    </div>
                  </th>
                  <th className="text-right py-3 px-2">Economia</th>
                </tr>
              </thead>
              <tbody>
                {depthEstimations.map((d) => {
                  const flashCost = (d.tokens / 1000) * realCostPer1K;
                  const liteCost = flashCost * 0.2; // 80% cheaper
                  const savings = ((flashCost - liteCost) / flashCost) * 100;
                  
                  return (
                    <tr key={d.depth} className="border-b border-border/50">
                      <td className="py-3 px-2">
                        <Badge 
                          className={`${
                            d.depth === 'Critical' ? 'bg-green-500/10 text-green-500' :
                            d.depth === 'Balanced' ? 'bg-blue-500/10 text-blue-500' :
                            'bg-purple-500/10 text-purple-500'
                          }`}
                        >
                          {d.depth}
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-2 font-mono">{d.contextLabel} tokens</td>
                      <td className="text-right py-3 px-2 font-medium text-orange-500">
                        R$ {flashCost.toFixed(4)}
                      </td>
                      <td className="text-right py-3 px-2 font-medium text-green-500">
                        R$ {liteCost.toFixed(4)}
                      </td>
                      <td className="text-right py-3 px-2">
                        <Badge className="bg-green-500/10 text-green-500">
                          {savings.toFixed(0)}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Analysis Type by Mode */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="p-6 bg-card border border-border rounded-xl animate-slide-up">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Distribuição por Tipo de Análise
            </h3>
            {analysisTypeStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2">Tipo</th>
                      <th className="text-right py-3 px-2">
                        <span className="flex items-center justify-end gap-1">
                          <Flame className="w-3 h-3 text-orange-500" />
                          Detalhado
                        </span>
                      </th>
                      <th className="text-right py-3 px-2">
                        <span className="flex items-center justify-end gap-1">
                          <Leaf className="w-3 h-3 text-green-500" />
                          Econômico
                        </span>
                      </th>
                      <th className="text-right py-3 px-2">Total</th>
                      <th className="text-right py-3 px-2">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisTypeStats.map((t) => (
                      <tr key={t.type} className="border-b border-border/50">
                        <td className="py-3 px-2 font-medium">
                          {ANALYSIS_TYPES_PT[t.type] || t.type}
                        </td>
                        <td className="text-right py-3 px-2">
                          {t.detailedCount > 0 ? (
                            <span className="text-orange-500">{t.detailedCount}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="text-right py-3 px-2">
                          {t.economicCount > 0 ? (
                            <span className="text-green-500">{t.economicCount}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="text-right py-3 px-2 font-medium">
                          {t.detailedCount + t.economicCount}
                        </td>
                        <td className="text-right py-3 px-2">
                          R$ {(t.totalCost * USD_TO_BRL).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhum dado de tipo de análise registrado ainda
              </p>
            )}
          </div>

          {/* Depth Comparison */}
          <div className="p-6 bg-card border border-border rounded-xl animate-slide-up">
            <h3 className="font-semibold text-lg mb-4">Comparativo por Profundidade</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2">Profundidade</th>
                    <th className="text-right py-3 px-2">Análises</th>
                    <th className="text-right py-3 px-2">Tokens Médios</th>
                    <th className="text-right py-3 px-2">Custo Médio</th>
                    <th className="text-right py-3 px-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {depthStats.map((d) => (
                    <tr key={d.depth} className="border-b border-border/50">
                      <td className="py-3 px-2">
                        <Badge 
                          className={`${
                            d.depth === 'critical' ? 'bg-green-500/10 text-green-500' :
                            d.depth === 'balanced' ? 'bg-blue-500/10 text-blue-500' :
                            'bg-purple-500/10 text-purple-500'
                          }`}
                        >
                          {d.depth.charAt(0).toUpperCase() + d.depth.slice(1)}
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-2">{d.count}</td>
                      <td className="text-right py-3 px-2 font-mono">{d.avgTokens.toLocaleString()}</td>
                      <td className="text-right py-3 px-2">R$ {(d.avgCost * USD_TO_BRL).toFixed(4)}</td>
                      <td className="text-right py-3 px-2 font-medium">R$ {(d.totalCost * USD_TO_BRL).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {depthStats.every(d => d.count === 0) && (
              <p className="text-center text-muted-foreground py-4">
                Ainda não há dados de profundidade registrados.
              </p>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.15s" }}>
            <h3 className="font-semibold text-lg mb-4">Uso Diário (últimos 14 dias)</h3>
            <div className="h-64">
              {dailyUsage.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyUsage}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-muted-foreground text-xs" />
                    <YAxis className="text-muted-foreground text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="analyses" fill="hsl(var(--primary))" name="Análises" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Sem dados de uso recentes
                </div>
              )}
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <h3 className="font-semibold text-lg mb-4">Custo Diário (R$)</h3>
            <div className="h-64">
              {dailyUsage.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyUsage}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-muted-foreground text-xs" />
                    <YAxis className="text-muted-foreground text-xs" tickFormatter={(v) => `R$${(v * USD_TO_BRL).toFixed(2)}`} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`R$ ${(value * USD_TO_BRL).toFixed(4)}`, 'Custo']}
                    />
                    <Line type="monotone" dataKey="cost" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Sem dados de custo recentes
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Evolution Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.22s" }}>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Custo Acumulado (R$)
            </h3>
            <div className="h-64">
              {dailyUsage.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyUsage.reduce((acc, d, i) => {
                    const prevCumulative = i > 0 ? acc[i - 1].cumulative : 0;
                    acc.push({ ...d, cumulative: prevCumulative + d.cost });
                    return acc;
                  }, [] as (DailyUsage & { cumulative: number })[] )}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-muted-foreground text-xs" />
                    <YAxis className="text-muted-foreground text-xs" tickFormatter={(v) => `R$${(v * USD_TO_BRL).toFixed(2)}`} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`R$ ${(value * USD_TO_BRL).toFixed(4)}`, 'Acumulado']}
                    />
                    <Line type="monotone" dataKey="cumulative" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={{ fill: 'hsl(142, 76%, 36%)' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Sem dados de custo acumulado
                </div>
              )}
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.24s" }}>
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
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value.toLocaleString()} tokens`, 'Tokens']}
                    />
                    <Bar dataKey="tokens" fill="hsl(262, 83%, 58%)" name="Tokens" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Sem dados de tokens
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROI Dashboard */}
        <div className="p-6 bg-card border border-border rounded-xl mb-8 animate-slide-up" style={{ animationDelay: "0.25s" }}>
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Dashboard de ROI por Plano
          </h3>
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {/* Free Plan ROI */}
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <Badge className="bg-muted text-muted-foreground">Free</Badge>
                <span className="text-xs text-muted-foreground">R$ 0/mês</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Receita:</span>
                  <span className="font-medium">R$ 0,00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo estimado:</span>
                  <span className="font-medium text-red-500">-R$ {((stats?.avgCostPerAnalysis || 0) * 5 * 7 * USD_TO_BRL).toFixed(2)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Margem:</span>
                  <span className="font-bold text-red-500">-100%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                * Custo de aquisição, usuários migram para pago
              </p>
            </div>

            {/* Basic Plan ROI */}
            <div className="p-4 bg-blue-500/5 rounded-lg border border-blue-500/20">
              <div className="flex items-center justify-between mb-3">
                <Badge className="bg-blue-500/10 text-blue-500">Basic</Badge>
                <span className="text-xs text-muted-foreground">R$ 29,90/mês</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Receita:</span>
                  <span className="font-medium text-green-500">R$ 29,90</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo estimado:</span>
                  <span className="font-medium">-R$ {((stats?.avgCostPerAnalysis || 0) * 20 * 7 * USD_TO_BRL).toFixed(2)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Margem:</span>
                  <span className={`font-bold ${29.90 - ((stats?.avgCostPerAnalysis || 0) * 20 * 7 * USD_TO_BRL) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {((29.90 - ((stats?.avgCostPerAnalysis || 0) * 20 * 7 * USD_TO_BRL)) / 29.90 * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                * 20 projetos × 7 análises/projeto
              </p>
            </div>

            {/* Pro Plan ROI */}
            <div className="p-4 bg-purple-500/5 rounded-lg border border-purple-500/20">
              <div className="flex items-center justify-between mb-3">
                <Badge className="bg-purple-500/10 text-purple-500">Pro</Badge>
                <span className="text-xs text-muted-foreground">R$ 79,90/mês</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Receita:</span>
                  <span className="font-medium text-green-500">R$ 79,90</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo estimado:</span>
                  <span className="font-medium">-R$ {((stats?.avgCostPerAnalysis || 0) * 50 * 7 * USD_TO_BRL).toFixed(2)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Margem:</span>
                  <span className={`font-bold ${79.90 - ((stats?.avgCostPerAnalysis || 0) * 50 * 7 * USD_TO_BRL) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {((79.90 - ((stats?.avgCostPerAnalysis || 0) * 50 * 7 * USD_TO_BRL)) / 79.90 * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                * 50 projetos × 7 análises/projeto
              </p>
            </div>
          </div>

          {/* ROI Alerts */}
          <div className="space-y-3">
            {((stats?.avgCostPerAnalysis || 0) * 20 * 7 * USD_TO_BRL) > 29.90 && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-600">Alerta: Plano Basic não é lucrativo</p>
                  <p className="text-xs text-muted-foreground">
                    Considere aumentar o preço ou reduzir limites de análise para este plano.
                  </p>
                </div>
              </div>
            )}
            {((stats?.avgCostPerAnalysis || 0) * 50 * 7 * USD_TO_BRL) > 79.90 && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-600">Alerta: Plano Pro não é lucrativo</p>
                  <p className="text-xs text-muted-foreground">
                    Considere ajustar preços ou promover uso do modo econômico.
                  </p>
                </div>
              </div>
            )}
            {potentialSavings > 0.5 && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
                <Leaf className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-600">Economia potencial: R$ {(potentialSavings * USD_TO_BRL).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    Se todas as análises detalhadas usassem modo econômico.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Projections */}
        <div className="p-6 bg-card border border-border rounded-xl mb-8 animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <h3 className="font-semibold text-lg mb-4">Projeções de Crescimento</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Com 100 usuários/mês</p>
              <p className="text-xl font-bold">R$ {(100 * 5 * (stats?.avgCostPerAnalysis || COST_PER_ANALYSIS) * 7 * USD_TO_BRL).toFixed(2)}/mês</p>
              <p className="text-xs text-muted-foreground">~5 análises por usuário, 7 tipos</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Com 500 usuários/mês</p>
              <p className="text-xl font-bold">R$ {(500 * 5 * (stats?.avgCostPerAnalysis || COST_PER_ANALYSIS) * 7 * USD_TO_BRL).toFixed(2)}/mês</p>
              <p className="text-xs text-muted-foreground">~5 análises por usuário, 7 tipos</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Com 1000 usuários/mês</p>
              <p className="text-xl font-bold">R$ {(1000 * 5 * (stats?.avgCostPerAnalysis || COST_PER_ANALYSIS) * 7 * USD_TO_BRL).toFixed(2)}/mês</p>
              <p className="text-xs text-muted-foreground">~5 análises por usuário, 7 tipos</p>
            </div>
          </div>
        </div>

        {/* Top Users */}
        <div className="p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.3s" }}>
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
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum dado de uso registrado ainda
                  </TableCell>
                </TableRow>
              ) : (
                userCosts.map((user, index) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">#{index + 1}</span>
                        <span className="font-medium">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`${
                        user.planName === 'Pro' ? 'bg-purple-500/10 text-purple-500' :
                        user.planName === 'Basic' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {user.planName}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{user.analysesCount}</TableCell>
                    <TableCell className="text-right font-mono">{user.totalTokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">
                      R$ {(user.estimatedCost * USD_TO_BRL).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default AdminCosts;