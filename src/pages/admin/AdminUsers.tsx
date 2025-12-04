import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Github, 
  Home, 
  Loader2, 
  Users, 
  ChevronLeft,
  Search,
  FolderGit2,
  Coins,
  Zap
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
import { Badge } from "@/components/ui/badge";

interface UserStats {
  user_id: string;
  email: string;
  projectCount: number;
  lastProject: string | null;
  totalTokens: number;
  estimatedCostUSD: number;
  estimatedCostBRL: number;
  planName: string;
}

const USD_TO_BRL = 5.5; // Taxa de conversão aproximada

const AdminUsers = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (adminLoading) return;

    if (!isAdmin) {
      toast.error("Acesso negado. Área restrita para administradores.");
      navigate("/dashboard");
      return;
    }

    loadUsers();
  }, [isAdmin, adminLoading, navigate]);

  const loadUsers = async () => {
    try {
      // Buscar todos os projetos com user_id
      const { data: projects, error } = await supabase
        .from("projects")
        .select("user_id, created_at")
        .not("user_id", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar perfis dos usuários
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name");

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Buscar dados de uso (tokens e custos)
      const { data: usageData } = await supabase
        .from("analysis_usage")
        .select("user_id, tokens_estimated, cost_estimated");

      // Agregar uso por usuário
      const usageMap = new Map<string, { tokens: number; cost: number }>();
      usageData?.forEach(u => {
        const existing = usageMap.get(u.user_id) || { tokens: 0, cost: 0 };
        usageMap.set(u.user_id, {
          tokens: existing.tokens + (u.tokens_estimated || 0),
          cost: existing.cost + Number(u.cost_estimated || 0),
        });
      });

      // Buscar planos dos usuários
      const { data: subscriptions } = await supabase
        .from("user_subscriptions")
        .select(`user_id, plans (name)`)
        .eq("status", "active");

      const planMap = new Map<string, string>();
      subscriptions?.forEach(s => {
        if (s.user_id && s.plans) {
          planMap.set(s.user_id, (s.plans as any).name || 'Free');
        }
      });

      // Agrupar por usuário
      const userMap = new Map<string, { count: number; lastProject: string }>();
      
      projects?.forEach((project) => {
        if (project.user_id) {
          const existing = userMap.get(project.user_id);
          if (existing) {
            existing.count++;
          } else {
            userMap.set(project.user_id, {
              count: 1,
              lastProject: project.created_at,
            });
          }
        }
      });

      // Converter para array com dados completos
      const userStats: UserStats[] = Array.from(userMap.entries()).map(([userId, stats]) => {
        const profile = profileMap.get(userId);
        const usage = usageMap.get(userId) || { tokens: 0, cost: 0 };
        
        return {
          user_id: userId,
          email: profile?.email || 'Sem email',
          projectCount: stats.count,
          lastProject: stats.lastProject,
          totalTokens: usage.tokens,
          estimatedCostUSD: usage.cost,
          estimatedCostBRL: usage.cost * USD_TO_BRL,
          planName: planMap.get(userId) || 'Free',
        };
      });

      // Ordenar por custo (maior primeiro)
      userStats.sort((a, b) => b.estimatedCostUSD - a.estimatedCostUSD);

      setUsers(userStats);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPlanBadge = (planName: string) => {
    const variants: Record<string, string> = {
      'Free': 'bg-muted text-muted-foreground',
      'Basic': 'bg-blue-500/10 text-blue-500',
      'Pro': 'bg-purple-500/10 text-purple-500',
    };
    return variants[planName] || variants['Free'];
  };

  // Totais
  const totalTokens = users.reduce((sum, u) => sum + u.totalTokens, 0);
  const totalCostUSD = users.reduce((sum, u) => sum + u.estimatedCostUSD, 0);
  const totalCostBRL = users.reduce((sum, u) => sum + u.estimatedCostBRL, 0);

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
              <ChevronLeft className="w-4 h-4 mr-2" />
              Admin
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
            <Users className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold">Usuários</h1>
          </div>
          <p className="text-muted-foreground">
            {users.length} usuários cadastrados
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6 animate-slide-up">
          <div className="p-4 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Total Usuários</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{totalTokens.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Tokens</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <Coins className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xl font-bold">R$ {totalCostBRL.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">(${totalCostUSD.toFixed(4)} USD)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 relative max-w-md animate-slide-up">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead className="text-center">Plano</TableHead>
                <TableHead className="text-center">Projetos</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Custo (R$)</TableHead>
                <TableHead>Última Atividade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <p className="font-medium">{user.email}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getPlanBadge(user.planName)}>
                        {user.planName}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-sm">
                        <FolderGit2 className="w-3 h-3" />
                        {user.projectCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {user.totalTokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <p className="font-medium">R$ {user.estimatedCostBRL.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">${user.estimatedCostUSD.toFixed(4)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.lastProject 
                        ? new Date(user.lastProject).toLocaleDateString("pt-BR")
                        : "-"
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigate(`/admin/projetos?user=${user.user_id}`)}
                      >
                        Ver Projetos
                      </Button>
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

export default AdminUsers;
