import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Github, Search, Star, GitFork, Lock, Globe, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  updated_at: string;
}

interface GitHubImportModalProps {
  onSelectRepo: (url: string) => void;
  trigger?: React.ReactNode;
}

export function GitHubImportModal({ onSelectRepo, trigger }: GitHubImportModalProps) {
  const [open, setOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Check if user has GitHub connected
  useEffect(() => {
    if (open) {
      checkGitHubConnection();
    }
  }, [open]);

  // Filter repos based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = repos.filter(repo => 
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredRepos(filtered);
    } else {
      setFilteredRepos(repos);
    }
  }, [searchQuery, repos]);

  const checkGitHubConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user has GitHub identity
      const githubIdentity = user.identities?.find(
        identity => identity.provider === 'github'
      );

      if (githubIdentity) {
        setIsConnected(true);
        fetchRepos();
      } else {
        setIsConnected(false);
      }
    } catch (err) {
      console.error("Error checking GitHub connection:", err);
    }
  };

  const connectGitHub = async () => {
    setIsConnecting(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}${window.location.pathname}?github_connected=true`,
          scopes: 'repo read:user',
        }
      });

      if (error) {
        // If user already has GitHub linked, try signing in with it
        if (error.message.includes('already linked')) {
          toast.info("Sua conta GitHub já está conectada!");
          setIsConnected(true);
          fetchRepos();
        } else {
          throw error;
        }
      }
    } catch (err: any) {
      console.error("Error connecting GitHub:", err);
      toast.error(err.message || "Erro ao conectar com GitHub");
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchRepos = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Sessão não encontrada");
      }

      // Save GitHub token if available (for private repos)
      if (session.provider_token) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const githubIdentity = user.identities?.find(i => i.provider === 'github');
          const githubUsername = githubIdentity?.identity_data?.user_name || 
                                 githubIdentity?.identity_data?.preferred_username;
          
          await supabase
            .from('profiles')
            .update({ 
              github_access_token: session.provider_token,
              github_username: githubUsername
            })
            .eq('id', user.id);
        }
      }

      const { data, error } = await supabase.functions.invoke('list-github-repos', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      if (data?.repos) {
        setRepos(data.repos);
        setFilteredRepos(data.repos);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.error("Error fetching repos:", err);
      setError(err.message || "Erro ao buscar repositórios");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRepo = (repo: GitHubRepo) => {
    onSelectRepo(repo.html_url);
    setOpen(false);
    toast.success(`Repositório "${repo.name}" selecionado!${repo.private ? ' (Privado)' : ''}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const languageColors: Record<string, string> = {
    TypeScript: "bg-blue-500",
    JavaScript: "bg-yellow-500",
    Python: "bg-green-500",
    Java: "bg-orange-500",
    Go: "bg-cyan-500",
    Rust: "bg-orange-600",
    Ruby: "bg-red-500",
    PHP: "bg-purple-500",
    "C#": "bg-green-600",
    "C++": "bg-pink-500",
    Swift: "bg-orange-400",
    Kotlin: "bg-purple-400",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Github className="w-4 h-4" />
            Importar do GitHub
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            Importar Repositório do GitHub
          </DialogTitle>
          <DialogDescription>
            Conecte sua conta GitHub para importar repositórios diretamente.
          </DialogDescription>
        </DialogHeader>

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Github className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-semibold">Conecte sua conta GitHub</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Conecte sua conta para ver e importar seus repositórios públicos e privados.
              </p>
            </div>
            <Button 
              onClick={connectGitHub} 
              disabled={isConnecting}
              className="gap-2"
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Github className="w-4 h-4" />
              )}
              {isConnecting ? "Conectando..." : "Conectar com GitHub"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search and Refresh */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar repositórios..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={fetchRepos}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {/* Repos List */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="p-4 border rounded-lg space-y-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="flex gap-4">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <AlertCircle className="w-10 h-10 text-destructive" />
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" onClick={fetchRepos}>
                  Tentar novamente
                </Button>
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-2">
                <Github className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "Nenhum repositório encontrado" : "Nenhum repositório disponível"}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {filteredRepos.map(repo => (
                    <button
                      key={repo.id}
                      onClick={() => handleSelectRepo(repo)}
                      className="w-full text-left p-4 border rounded-lg hover:border-primary hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{repo.name}</span>
                            {repo.private ? (
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <Lock className="w-3 h-3" />
                                Privado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <Globe className="w-3 h-3" />
                                Público
                              </Badge>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {repo.language && (
                              <span className="flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full ${languageColors[repo.language] || 'bg-gray-500'}`} />
                                {repo.language}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3" />
                              {repo.stargazers_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <GitFork className="w-3 h-3" />
                              {repo.forks_count}
                            </span>
                            <span>Atualizado em {formatDate(repo.updated_at)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
            
            <p className="text-xs text-muted-foreground text-center">
              Repositórios públicos e privados podem ser analisados. Seu token é armazenado com segurança.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
