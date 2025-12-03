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
  ArrowLeft
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
  Legend
} from "recharts";

interface CostStats {
  totalAnalyses: number;
  estimatedTotalCost: number;
  avgCostPerAnalysis: number;
  avgCostPerUser: number;
  totalUsers: number;
}

interface DailyUsage {
  date: string;
  analyses: number;
  cost: number;
}

interface UserCost {
  userId: string;
  email: string;
  analysesCount: number;
  estimatedCost: number;
  planName: string;
}

// Estimated cost per analysis type (based on Gemini Flash pricing)
const COST_PER_ANALYSIS = 0.002; // ~$0.002 per analysis (input + output tokens)

const AdminCosts = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [stats, setStats] = useState<CostStats | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [userCosts, setUserCosts] = useState<UserCost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (adminLoading) return;

    if (!isAdmin) {
      toast.error("Acesso negado. Área restrita para administradores.");
      navigate("/dashboard");
      return;
    }

    const loadCostData = async () => {
      try {
        // Get real usage data from analysis_usage table
        const { data: usageData } = await supabase
          .from("analysis_usage")
          .select("*");

        // Calculate real costs from usage data
        const realTotalCost = usageData?.reduce((sum, u) => sum + Number(u.cost_estimated || 0), 0) || 0;
        const realTotalTokens = usageData?.reduce((sum, u) => sum + (u.tokens_estimated || 0), 0) || 0;

        // Total analyses (fallback to old method if no usage data)
        const { count: totalAnalyses } = await supabase
          .from("analyses")
          .select("*", { count: "exact", head: true });

        // Get unique users
        const { data: projects } = await supabase
          .from("projects")
          .select("user_id")
          .not("user_id", "is", null);

        const uniqueUsers = new Set(projects?.map(p => p.user_id) || []);
        const totalUsers = uniqueUsers.size;

        // Use real costs if available, otherwise estimate
        const hasRealData = usageData && usageData.length > 0;
        const estimatedTotalCost = hasRealData ? realTotalCost : (totalAnalyses || 0) * COST_PER_ANALYSIS;
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
        });

        // Get daily usage for last 30 days - prefer usage data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Group usage by date
        const dailyMap = new Map<string, { analyses: number; cost: number; tokens: number }>();
        
        if (hasRealData) {
          usageData?.forEach(u => {
            const date = new Date(u.created_at!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const existing = dailyMap.get(date) || { analyses: 0, cost: 0, tokens: 0 };
            dailyMap.set(date, {
              analyses: existing.analyses + 1,
              cost: existing.cost + Number(u.cost_estimated || 0),
              tokens: existing.tokens + (u.tokens_estimated || 0),
            });
          });
        } else {
          // Fallback to analyses table
          const { data: analysesData } = await supabase
            .from("analyses")
            .select("created_at")
            .gte("created_at", thirtyDaysAgo.toISOString());

          analysesData?.forEach(a => {
            const date = new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const existing = dailyMap.get(date) || { analyses: 0, cost: 0, tokens: 0 };
            dailyMap.set(date, {
              analyses: existing.analyses + 1,
              cost: existing.cost + COST_PER_ANALYSIS,
              tokens: 0,
            });
          });
        }

        const dailyData: DailyUsage[] = Array.from(dailyMap.entries())
          .map(([date, data]) => ({
            date,
            analyses: data.analyses,
            cost: data.cost,
          }))
          .sort((a, b) => {
            const [dayA, monthA] = a.date.split('/').map(Number);
            const [dayB, monthB] = b.date.split('/').map(Number);
            return monthA - monthB || dayA - dayB;
          })
          .slice(-14);

        setDailyUsage(dailyData);

        // Get cost per user from real data
        const userCostMap = new Map<string, { count: number; cost: number }>();
        
        if (hasRealData) {
          usageData?.forEach(u => {
            const existing = userCostMap.get(u.user_id) || { count: 0, cost: 0 };
            userCostMap.set(u.user_id, {
              count: existing.count + 1,
              cost: existing.cost + Number(u.cost_estimated || 0),
            });
          });
        } else {
          // Fallback to projects/analyses
          const { data: userProjects } = await supabase
            .from("projects")
            .select(`user_id, analyses (id)`)
            .not("user_id", "is", null);

          userProjects?.forEach(p => {
            if (p.user_id) {
              const count = Array.isArray(p.analyses) ? p.analyses.length : 0;
              const existing = userCostMap.get(p.user_id) || { count: 0, cost: 0 };
              userCostMap.set(p.user_id, {
                count: existing.count + count,
                cost: existing.cost + (count * COST_PER_ANALYSIS),
              });
            }
          });
        }

        // Get user subscriptions for plan info
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
            email: `user-${userId.slice(0, 8)}...`,
            analysesCount: data.count,
            estimatedCost: data.cost,
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

    loadCostData();
  }, [isAdmin, adminLoading, navigate]);

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Projections
  const dailyAvg = dailyUsage.length > 0 
    ? dailyUsage.reduce((sum, d) => sum + d.analyses, 0) / dailyUsage.length 
    : 0;
  const monthlyProjection = dailyAvg * 30;
  const monthlyProjectedCost = monthlyProjection * COST_PER_ANALYSIS;

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
            Estimativas de custos de IA e projeções de uso
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-slide-up">
          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats?.estimatedTotalCost.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">Custo Total Estimado</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Calculator className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats?.avgCostPerAnalysis.toFixed(4)}</p>
                <p className="text-sm text-muted-foreground">Custo/Análise</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats?.avgCostPerUser.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">Custo/Usuário</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">${monthlyProjectedCost.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">Projeção Mensal</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Usage Chart */}
          <div className="p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <h3 className="font-semibold text-lg mb-4">Uso Diário (últimos 14 dias)</h3>
            <div className="h-64">
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
            </div>
          </div>

          {/* Cost Chart */}
          <div className="p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.15s" }}>
            <h3 className="font-semibold text-lg mb-4">Custo Diário Estimado</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-muted-foreground text-xs" />
                  <YAxis className="text-muted-foreground text-xs" tickFormatter={(v) => `$${v.toFixed(3)}`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`$${value.toFixed(4)}`, 'Custo']}
                  />
                  <Line type="monotone" dataKey="cost" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Projections */}
        <div className="p-6 bg-card border border-border rounded-xl mb-8 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <h3 className="font-semibold text-lg mb-4">Projeções de Crescimento</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Com 100 usuários/mês</p>
              <p className="text-xl font-bold">${(100 * 5 * COST_PER_ANALYSIS * 7).toFixed(2)}/mês</p>
              <p className="text-xs text-muted-foreground">~5 análises por usuário, 7 tipos</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Com 500 usuários/mês</p>
              <p className="text-xl font-bold">${(500 * 5 * COST_PER_ANALYSIS * 7).toFixed(2)}/mês</p>
              <p className="text-xs text-muted-foreground">~5 análises por usuário, 7 tipos</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Com 1000 usuários/mês</p>
              <p className="text-xl font-bold">${(1000 * 5 * COST_PER_ANALYSIS * 7).toFixed(2)}/mês</p>
              <p className="text-xs text-muted-foreground">~5 análises por usuário, 7 tipos</p>
            </div>
          </div>
        </div>

        {/* Top Users by Cost */}
        <div className="p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.25s" }}>
          <h3 className="font-semibold text-lg mb-4">Top 10 Usuários por Custo</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="text-right">Análises</TableHead>
                <TableHead className="text-right">Custo Estimado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userCosts.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell className="font-mono text-sm">{user.email}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.planName === 'Pro' ? 'bg-purple-500/10 text-purple-500' :
                      user.planName === 'Basic' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {user.planName}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{user.analysesCount}</TableCell>
                  <TableCell className="text-right font-medium">${user.estimatedCost.toFixed(4)}</TableCell>
                </TableRow>
              ))}
              {userCosts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum dado de uso disponível
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pricing Info */}
        <div className="mt-8 p-4 bg-muted/30 rounded-lg text-sm text-muted-foreground">
          <p className="font-medium mb-2">ℹ️ Sobre as estimativas de custo:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Custo base por análise: ~$0.002 (usando Google Gemini Flash)</li>
            <li>Cada projeto gera até 7 análises diferentes</li>
            <li>Os custos reais podem variar baseado no tamanho do repositório</li>
            <li>Projeções assumem média de 5 projetos por usuário</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default AdminCosts;
