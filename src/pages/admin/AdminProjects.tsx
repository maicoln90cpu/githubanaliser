import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Github, 
  Home, 
  Loader2, 
  FolderGit2, 
  ChevronLeft,
  Search,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock
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

interface Project {
  id: string;
  name: string;
  github_url: string;
  created_at: string;
  analysis_status: string | null;
  user_id: string | null;
}

const AdminProjects = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userFilter = searchParams.get("user");
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (adminLoading) return;

    if (!isAdmin) {
      toast.error("Acesso negado. Área restrita para administradores.");
      navigate("/dashboard");
      return;
    }

    const loadProjects = async () => {
      try {
        let query = supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false });

        if (userFilter) {
          query = query.eq("user_id", userFilter);
        }

        const { data, error } = await query;

        if (error) throw error;
        setProjects(data || []);
      } catch (error) {
        console.error("Erro ao carregar projetos:", error);
        toast.error("Erro ao carregar projetos");
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [isAdmin, adminLoading, navigate, userFilter]);

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return <span className="px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-500">Concluído</span>;
      case "error":
        return <span className="px-2 py-1 text-xs rounded-full bg-red-500/10 text-red-500">Erro</span>;
      case "pending":
        return <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">Pendente</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-500">Em andamento</span>;
    }
  };

  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.github_url.toLowerCase().includes(searchTerm.toLowerCase())
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
            <FolderGit2 className="w-8 h-8 text-purple-500" />
            <h1 className="text-3xl font-bold">Projetos</h1>
          </div>
          <p className="text-muted-foreground">
            {projects.length} projetos 
            {userFilter && " deste usuário"}
          </p>
          {userFilter && (
            <Button 
              variant="link" 
              className="p-0 h-auto text-sm"
              onClick={() => navigate("/admin/projetos")}
            >
              Ver todos os projetos
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="mb-6 relative max-w-md animate-slide-up">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou URL..."
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
                <TableHead>Projeto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum projeto encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <a 
                          href={project.github_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                        >
                          {project.github_url.replace("https://github.com/", "")}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(project.analysis_status)}
                        {getStatusBadge(project.analysis_status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(project.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      {project.analysis_status === "completed" && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate(`/projeto/${project.id}`)}
                        >
                          Ver Análises
                        </Button>
                      )}
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

export default AdminProjects;
