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
  Clock,
  Trash2,
  Coins,
  Zap,
  ChevronDown,
  ChevronUp,
  Flame,
  Leaf
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { isEconomicModel } from "@/lib/modelCategories";

interface ProjectAnalysis {
  type: string;
  count: number;
  mode: 'detailed' | 'economic';
  modelUsed: string;
  depthLevel: string;
  tokens: number;
  cost: number;
}

interface Project {
  id: string;
  name: string;
  github_url: string;
  created_at: string;
  analysis_status: string | null;
  user_id: string | null;
  userEmail: string;
  totalTokens: number;
  estimatedCostBRL: number;
  analysesDetails: ProjectAnalysis[];
  totalAnalysesCount: number;
}

const USD_TO_BRL = 5.5;

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

const AdminProjects = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userFilter = searchParams.get("user");
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (adminLoading) return;

    if (!isAdmin) {
      toast.error("Acesso negado. Área restrita para administradores.");
      navigate("/dashboard");
      return;
    }

    loadProjects();
  }, [isAdmin, adminLoading, navigate, userFilter]);

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

      // Buscar perfis dos usuários
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email");

      const profileMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

      // Buscar dados de uso detalhados por projeto
      const { data: usageData } = await supabase
        .from("analysis_usage")
        .select("project_id, analysis_type, tokens_estimated, cost_estimated, model_used, depth_level");

      // Agregar uso por projeto com detalhes
      const usageMap = new Map<string, { 
        tokens: number; 
        cost: number; 
        details: Map<string, { count: number; tokens: number; cost: number; mode: 'detailed' | 'economic'; model: string; depth: string }>;
      }>();

      usageData?.forEach(u => {
        if (u.project_id) {
          const existing = usageMap.get(u.project_id) || { 
            tokens: 0, 
            cost: 0, 
            details: new Map() 
          };
          
          const type = u.analysis_type || 'unknown';
          const mode = isEconomicModel(u.model_used) ? 'economic' : 'detailed';
          const detailKey = `${type}-${mode}-${u.depth_level || 'complete'}`;
          
          const detail = existing.details.get(detailKey) || { 
            count: 0, 
            tokens: 0, 
            cost: 0, 
            mode, 
            model: u.model_used || 'unknown',
            depth: u.depth_level || 'complete'
          };
          
          detail.count += 1;
          detail.tokens += u.tokens_estimated || 0;
          detail.cost += Number(u.cost_estimated || 0);
          existing.details.set(detailKey, detail);
          
          existing.tokens += u.tokens_estimated || 0;
          existing.cost += Number(u.cost_estimated || 0);
          
          usageMap.set(u.project_id, existing);
        }
      });

      // Enriquecer projetos com dados de usuário e uso
      const enrichedProjects: Project[] = (data || []).map(p => {
        const usage = usageMap.get(p.id) || { tokens: 0, cost: 0, details: new Map() };
        
        // Convert details map to array
        const analysesDetails: ProjectAnalysis[] = [];
        let totalCount = 0;
        
        usage.details.forEach((detail, key) => {
          const [type] = key.split('-');
          analysesDetails.push({
            type,
            count: detail.count,
            mode: detail.mode,
            modelUsed: detail.model,
            depthLevel: detail.depth,
            tokens: detail.tokens,
            cost: detail.cost,
          });
          totalCount += detail.count;
        });
        
        // Sort by count descending
        analysesDetails.sort((a, b) => b.count - a.count);
        
        return {
          ...p,
          userEmail: p.user_id ? (profileMap.get(p.user_id) || 'Sem email') : 'Anônimo',
          totalTokens: usage.tokens,
          estimatedCostBRL: usage.cost * USD_TO_BRL,
          analysesDetails,
          totalAnalysesCount: totalCount,
        };
      });

      setProjects(enrichedProjects);
    } catch (error) {
      console.error("Erro ao carregar projetos:", error);
      toast.error("Erro ao carregar projetos");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    
    setDeleting(true);
    try {
      const { error: analysesError } = await supabase
        .from("analyses")
        .delete()
        .eq("project_id", projectToDelete.id);

      if (analysesError) {
        console.error("Erro ao deletar análises:", analysesError);
      }

      const { error: projectError } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectToDelete.id);

      if (projectError) throw projectError;

      toast.success(`Projeto "${projectToDelete.name}" excluído com sucesso`);
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
    } catch (error) {
      console.error("Erro ao excluir projeto:", error);
      toast.error("Erro ao excluir projeto");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

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

  const getModeBadge = (mode: 'detailed' | 'economic') => {
    if (mode === 'detailed') {
      return (
        <Badge className="bg-orange-500/10 text-orange-500 text-xs">
          <Flame className="w-3 h-3 mr-1" />
          Detalhado
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-500/10 text-green-500 text-xs">
        <Leaf className="w-3 h-3 mr-1" />
        Econômico
      </Badge>
    );
  };

  const getDepthBadge = (depth: string) => {
    const depthColors: Record<string, string> = {
      'critical': 'bg-green-500/10 text-green-500',
      'balanced': 'bg-blue-500/10 text-blue-500',
      'complete': 'bg-purple-500/10 text-purple-500',
    };
    return (
      <Badge className={`text-xs ${depthColors[depth] || 'bg-muted text-muted-foreground'}`}>
        {depth.charAt(0).toUpperCase() + depth.slice(1)}
      </Badge>
    );
  };

  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.github_url.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Totals
  const totalTokens = projects.reduce((sum, p) => sum + p.totalTokens, 0);
  const totalCostBRL = projects.reduce((sum, p) => sum + p.estimatedCostBRL, 0);
  const totalAnalyses = projects.reduce((sum, p) => sum + p.totalAnalysesCount, 0);

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
            {projects.length} projetos • {totalAnalyses} análises executadas
            {userFilter && " (filtrado por usuário)"}
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

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-6 animate-slide-up">
          <div className="p-4 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <FolderGit2 className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{projects.length}</p>
                <p className="text-sm text-muted-foreground">Projetos</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{totalAnalyses}</p>
                <p className="text-sm text-muted-foreground">Análises</p>
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
                <p className="text-sm text-muted-foreground">Tokens</p>
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
                <p className="text-sm text-muted-foreground">Custo Total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 relative max-w-md animate-slide-up">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, URL ou usuário..."
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
                <TableHead className="w-8"></TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Análises</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Custo (R$)</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum projeto encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredProjects.map((project) => (
                  <Collapsible key={project.id} asChild open={expandedProjects.has(project.id)}>
                    <>
                      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => project.analysesDetails.length > 0 && toggleProjectExpand(project.id)}>
                        <TableCell>
                          {project.analysesDetails.length > 0 && (
                            <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                                {expandedProjects.has(project.id) ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{project.name}</p>
                            <a 
                              href={project.github_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {project.github_url.replace("https://github.com/", "")}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{project.userEmail}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(project.analysis_status)}
                            {getStatusBadge(project.analysis_status)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-medium">{project.totalAnalysesCount}</span>
                            {project.analysesDetails.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {project.analysesDetails.length} tipos
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {project.totalTokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          R$ {project.estimatedCostBRL.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {new Date(project.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {project.analysis_status === "completed" && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => navigate(`/projeto/${project.id}`)}
                              >
                                Ver Análises
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setProjectToDelete(project);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={9} className="p-0">
                            <div className="px-6 py-4">
                              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-primary" />
                                Detalhes das Análises
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-border">
                                      <th className="text-left py-2 px-3">Tipo</th>
                                      <th className="text-left py-2 px-3">Modo</th>
                                      <th className="text-left py-2 px-3">Profundidade</th>
                                      <th className="text-center py-2 px-3">Execuções</th>
                                      <th className="text-right py-2 px-3">Tokens</th>
                                      <th className="text-right py-2 px-3">Custo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {project.analysesDetails.map((analysis, idx) => (
                                      <tr key={idx} className="border-b border-border/50">
                                        <td className="py-2 px-3 font-medium">
                                          {ANALYSIS_TYPES_PT[analysis.type] || analysis.type}
                                        </td>
                                        <td className="py-2 px-3">
                                          {getModeBadge(analysis.mode)}
                                        </td>
                                        <td className="py-2 px-3">
                                          {getDepthBadge(analysis.depthLevel)}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                          <Badge variant="outline" className="text-xs">
                                            {analysis.count}x
                                          </Badge>
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-xs">
                                          {analysis.tokens.toLocaleString()}
                                        </td>
                                        <td className="py-2 px-3 text-right font-medium">
                                          R$ {(analysis.cost * USD_TO_BRL).toFixed(4)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              
                              {/* Summary badges */}
                              <div className="mt-3 flex flex-wrap gap-2">
                                {project.analysesDetails.some(a => a.mode === 'detailed') && (
                                  <Badge className="bg-orange-500/10 text-orange-500 text-xs">
                                    <Flame className="w-3 h-3 mr-1" />
                                    {project.analysesDetails.filter(a => a.mode === 'detailed').reduce((sum, a) => sum + a.count, 0)} detalhadas
                                  </Badge>
                                )}
                                {project.analysesDetails.some(a => a.mode === 'economic') && (
                                  <Badge className="bg-green-500/10 text-green-500 text-xs">
                                    <Leaf className="w-3 h-3 mr-1" />
                                    {project.analysesDetails.filter(a => a.mode === 'economic').reduce((sum, a) => sum + a.count, 0)} econômicas
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o projeto <strong>"{projectToDelete?.name}"</strong>?
              <br /><br />
              Esta ação é irreversível e irá excluir:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>O projeto e seus dados</li>
                <li>Todas as análises associadas</li>
                <li>Dados em cache do GitHub</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProject}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProjects;