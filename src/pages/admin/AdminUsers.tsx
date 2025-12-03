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
  FolderGit2
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

interface UserStats {
  user_id: string;
  email: string;
  projectCount: number;
  lastProject: string | null;
}

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

    const loadUsers = async () => {
      try {
        // Buscar todos os projetos com user_id
        const { data: projects, error } = await supabase
          .from("projects")
          .select("user_id, created_at")
          .not("user_id", "is", null)
          .order("created_at", { ascending: false });

        if (error) throw error;

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

        // Converter para array
        const userStats: UserStats[] = Array.from(userMap.entries()).map(([userId, stats]) => ({
          user_id: userId,
          email: userId.substring(0, 8) + "...", // Placeholder, já que não temos acesso ao auth.users
          projectCount: stats.count,
          lastProject: stats.lastProject,
        }));

        setUsers(userStats);
      } catch (error) {
        console.error("Erro ao carregar usuários:", error);
        toast.error("Erro ao carregar usuários");
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [isAdmin, adminLoading, navigate]);

  const filteredUsers = users.filter(user => 
    user.user_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

        {/* Search */}
        <div className="mb-6 relative max-w-md animate-slide-up">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID..."
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
                <TableHead>ID do Usuário</TableHead>
                <TableHead className="text-center">Projetos</TableHead>
                <TableHead>Última Atividade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-mono text-sm">
                      {user.user_id.substring(0, 20)}...
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-sm">
                        <FolderGit2 className="w-3 h-3" />
                        {user.projectCount}
                      </span>
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
