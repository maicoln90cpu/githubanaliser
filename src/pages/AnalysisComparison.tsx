import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Github, 
  Home, 
  Loader2, 
  ArrowLeft,
  Zap,
  Scale,
  BarChart3,
  Flame,
  Leaf,
  GitCompare
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface VersionInfo {
  id: string;
  depth_level: string | null;
  model_used: string | null;
  created_at: string;
  tokens_estimated: number | null;
}

interface AnalysisContent {
  id: string;
  content: string;
  type: string;
  created_at: string;
}

const depthLabels: Record<string, { label: string; icon: typeof Zap; className: string }> = {
  critical: { label: "Crítico", icon: Zap, className: "bg-orange-500/10 text-orange-500" },
  balanced: { label: "Balanceado", icon: Scale, className: "bg-blue-500/10 text-blue-500" },
  complete: { label: "Completo", icon: BarChart3, className: "bg-green-500/10 text-green-500" },
};

const modeLabels: Record<string, { label: string; icon: typeof Flame; className: string }> = {
  detailed: { label: "Detalhado", icon: Flame, className: "bg-orange-500/10 text-orange-500" },
  economic: { label: "Econômico", icon: Leaf, className: "bg-green-500/10 text-green-500" },
};

const AnalysisComparison = () => {
  const { id: projectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  
  const analysisType = searchParams.get("type") || "prd";
  const version1Param = searchParams.get("v1");
  const version2Param = searchParams.get("v2");
  
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState("");
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [analysisContent, setAnalysisContent] = useState<AnalysisContent | null>(null);
  const [selectedV1, setSelectedV1] = useState<number>(0);
  const [selectedV2, setSelectedV2] = useState<number>(1);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    loadData();
  }, [projectId, analysisType, user, authLoading]);

  const loadData = async () => {
    try {
      // Load project name
      const { data: project } = await supabase
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .maybeSingle();
      
      if (project) setProjectName(project.name);

      // Load versions from analysis_usage (source of truth for multiple versions)
      const { data: usageData, error: usageError } = await supabase
        .from("analysis_usage")
        .select("id, depth_level, model_used, created_at, tokens_estimated")
        .eq("project_id", projectId)
        .eq("analysis_type", analysisType)
        .order("created_at", { ascending: false });

      if (usageError) {
        console.error("Error loading usage data:", usageError);
        toast.error("Erro ao carregar versões");
        setLoading(false);
        return;
      }

      // Load the analysis content (single record with latest content)
      const { data: analysisData } = await supabase
        .from("analyses")
        .select("*")
        .eq("project_id", projectId)
        .eq("type", analysisType)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setVersions(usageData || []);
      setAnalysisContent(analysisData);

      // Set initial selections from URL params
      if (version1Param) setSelectedV1(parseInt(version1Param));
      if (version2Param) setSelectedV2(parseInt(version2Param));

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const getVersionLabel = (index: number): string => {
    const version = versions[index];
    if (!version) return `Versão ${index + 1}`;
    
    const depth = version.depth_level ? depthLabels[version.depth_level]?.label : "—";
    const mode = version.model_used?.includes("lite") ? "Econômico" : "Detalhado";
    const date = version.created_at 
      ? new Date(version.created_at).toLocaleDateString("pt-BR", { 
          day: "2-digit", 
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "";
    
    return `${depth} • ${mode} • ${date}`;
  };

  const getVersionContent = (index: number): string => {
    // Since analyses table only stores the latest version,
    // we show metadata about each version but note that content is the same
    // In a future improvement, we could store full content per version
    const version = versions[index];
    if (!version) return "Conteúdo não disponível";
    
    // If this is the most recent version (index 0), show the actual content
    if (index === 0 && analysisContent) {
      return analysisContent.content;
    }
    
    // For older versions, show metadata since we don't have the old content
    const depth = version.depth_level ? depthLabels[version.depth_level]?.label : "Desconhecido";
    const mode = version.model_used?.includes("lite") ? "Econômico" : "Detalhado";
    const tokens = version.tokens_estimated || 0;
    const date = version.created_at 
      ? new Date(version.created_at).toLocaleString("pt-BR")
      : "Data desconhecida";

    return `## ⚠️ Conteúdo não disponível

Esta é uma versão anterior da análise. O sistema atualmente armazena apenas o conteúdo da versão mais recente.

### Informações desta versão:

| Propriedade | Valor |
|-------------|-------|
| **Profundidade** | ${depth} |
| **Modo** | ${mode} |
| **Tokens usados** | ${tokens.toLocaleString("pt-BR")} |
| **Data de criação** | ${date} |

---

*Para comparar conteúdos completos, gere uma nova análise com configurações diferentes.*`;
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (versions.length < 2) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
              <Github className="w-6 h-6 text-foreground" />
              <span className="font-semibold text-xl">GitAnalyzer</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/projeto/${projectId}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-16 text-center">
          <GitCompare className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Comparação não disponível</h2>
          <p className="text-muted-foreground mb-6">
            É necessário ter pelo menos 2 versões da análise para comparar.
            <br />
            <span className="text-sm">
              Atualmente existem {versions.length} versão(ões) registrada(s).
            </span>
          </p>
          <Button onClick={() => navigate(`/projeto/${projectId}`)}>
            Voltar para o Projeto
          </Button>
        </main>
      </div>
    );
  }

  const version1 = versions[selectedV1];
  const version2 = versions[selectedV2];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <Github className="w-6 h-6 text-foreground" />
            <span className="font-semibold text-xl">GitAnalyzer</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/projeto/${projectId}`)}>
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
            <GitCompare className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold">Comparar Versões</h1>
            <Badge variant="secondary">{versions.length} versões</Badge>
          </div>
          <p className="text-muted-foreground">{projectName}</p>
        </div>

        {/* Version Selectors */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-card border border-border rounded-lg">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Versão 1</label>
            <select 
              value={selectedV1}
              onChange={(e) => setSelectedV1(parseInt(e.target.value))}
              className="w-full p-2 bg-background border border-border rounded-md"
            >
              {versions.map((_, idx) => (
                <option key={idx} value={idx} disabled={idx === selectedV2}>
                  {getVersionLabel(idx)}
                </option>
              ))}
            </select>
            {version1 && (
              <div className="flex gap-2 mt-2">
                {version1.depth_level && (
                  <Badge className={depthLabels[version1.depth_level]?.className}>
                    {depthLabels[version1.depth_level]?.label}
                  </Badge>
                )}
                <Badge className={version1.model_used?.includes("lite") ? modeLabels.economic.className : modeLabels.detailed.className}>
                  {version1.model_used?.includes("lite") ? "Econômico" : "Detalhado"}
                </Badge>
              </div>
            )}
          </div>

          <div className="p-4 bg-card border border-border rounded-lg">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Versão 2</label>
            <select 
              value={selectedV2}
              onChange={(e) => setSelectedV2(parseInt(e.target.value))}
              className="w-full p-2 bg-background border border-border rounded-md"
            >
              {versions.map((_, idx) => (
                <option key={idx} value={idx} disabled={idx === selectedV1}>
                  {getVersionLabel(idx)}
                </option>
              ))}
            </select>
            {version2 && (
              <div className="flex gap-2 mt-2">
                {version2.depth_level && (
                  <Badge className={depthLabels[version2.depth_level]?.className}>
                    {depthLabels[version2.depth_level]?.label}
                  </Badge>
                )}
                <Badge className={version2.model_used?.includes("lite") ? modeLabels.economic.className : modeLabels.detailed.className}>
                  {version2.model_used?.includes("lite") ? "Econômico" : "Detalhado"}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Side by Side Comparison */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-6 max-h-[70vh] overflow-y-auto">
            <div className="prose prose-slate dark:prose-invert max-w-none prose-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {getVersionContent(selectedV1)}
              </ReactMarkdown>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 max-h-[70vh] overflow-y-auto">
            <div className="prose prose-slate dark:prose-invert max-w-none prose-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {getVersionContent(selectedV2)}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AnalysisComparison;
