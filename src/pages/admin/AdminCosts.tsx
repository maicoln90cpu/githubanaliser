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
  BarChart3
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
  Cell
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

const USD_TO_BRL = 5.5;
const COST_PER_ANALYSIS = 0.002;

const DEPTH_COLORS = {
  'critical': 'hsl(142, 76%, 36%)',
  'balanced': 'hsl(217, 91%, 60%)', 
  'complete': 'hsl(262, 83%, 58%)',
};

const AdminCosts = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [stats, setStats] = useState<CostStats | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [userCosts, setUserCosts] = useState<UserCost[]>([]);
  const [depthStats, setDepthStats] = useState<DepthStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);

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

      // Depth statistics (simulated based on model used)
      const depthMap = new Map<string, { count: number; tokens: number; cost: number }>();
      
      usageData?.forEach(u => {
        // Infer depth from model or context size
        let depth = 'complete';
        if (u.model_used?.includes('lite')) {
          depth = u.tokens_estimated && u.tokens_estimated < 5000 ? 'critical' : 'balanced';
        }
        
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

  const pieData = depthStats.filter(d => d.count > 0).map(d => ({
    name: d.depth.charAt(0).toUpperCase() + d.depth.slice(1),
    value: d.count,
    color: DEPTH_COLORS[d.depth as keyof typeof DEPTH_COLORS],
  }));

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
                ? `${stats?.totalTokens.toLocaleString()} tokens registrados • ${stats?.totalAnalyses} análises rastreadas`
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

        {/* Depth Comparison */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.05s" }}>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Comparativo por Profundidade
            </h3>
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

          {/* Pie Chart */}
          <div className="p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <h3 className="font-semibold text-lg mb-4">Distribuição por Profundidade</h3>
            {pieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
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

        {/* Projections */}
        <div className="p-6 bg-card border border-border rounded-xl mb-8 animate-slide-up" style={{ animationDelay: "0.25s" }}>
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
