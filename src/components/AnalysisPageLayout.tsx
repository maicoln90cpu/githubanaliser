import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Github, Home, Loader2, Download, Grid3X3, ChevronLeft, ChevronRight, LucideIcon, RefreshCw, AlertCircle, Lock, Info } from "lucide-react";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import { CheckableMarkdown } from "./CheckableMarkdown";
import { useUserPlan } from "@/hooks/useUserPlan";
import { ViabilityScore } from "./ViabilityScore";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AnalysisPageLayoutProps {
  type: string;
  title: string;
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  prevRoute?: { path: string; label: string };
  nextRoute?: { path: string; label: string };
}

interface Project {
  id: string;
  name: string;
  github_url: string;
  github_data: unknown;
}

interface Analysis {
  id: string;
  content: string;
  type: string;
}

const AnalysisPageLayout = ({
  type,
  title,
  icon: Icon,
  iconColor,
  iconBgColor,
  prevRoute,
  nextRoute,
}: AnalysisPageLayoutProps) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { plan } = useUserPlan();
  const [project, setProject] = useState<Project | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisNotFound, setAnalysisNotFound] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  
  const canExportPDF = plan?.canExportPDF || plan?.isAdmin;

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("*")
          .eq("id", id)
          .single();

        if (projectError || !projectData) {
          toast.error("Projeto não encontrado");
          navigate("/dashboard");
          return;
        }

        setProject(projectData);

        const { data: analysisData, error: analysisError } = await supabase
          .from("analyses")
          .select("*")
          .eq("project_id", id)
          .eq("type", type)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (analysisError || !analysisData) {
          setAnalysisNotFound(true);
        } else {
          setAnalysis(analysisData);
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast.error("Erro ao carregar análise");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, type, navigate]);

  const handleRegenerateAnalysis = async () => {
    if (!project) return;
    
    setRegenerating(true);
    
    const hasCachedData = project.github_data !== null && project.github_data !== undefined;
    
    toast.info(hasCachedData 
      ? "Usando dados em cache para economizar recursos..." 
      : "Iniciando geração da análise..."
    );
    
    navigate(`/analisando?projectId=${id}&analysisTypes=${type}&useCache=${hasCachedData}`);
  };

  const exportToPDF = () => {
    const element = document.getElementById("analysis-content");
    if (!element) return;
    
    const wrapper = document.createElement("div");
    wrapper.innerHTML = element.innerHTML;
    wrapper.style.cssText = `
      color: #000000 !important;
      background-color: #ffffff !important;
      font-family: Arial, sans-serif;
      padding: 20px;
    `;
    
    const allElements = wrapper.querySelectorAll("*");
    allElements.forEach((el) => {
      (el as HTMLElement).style.color = "#000000";
      (el as HTMLElement).style.backgroundColor = "transparent";
    });
    
    document.body.appendChild(wrapper);
    
    const opt = {
      margin: 0.5,
      filename: `${project?.name}-${type}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      },
      jsPDF: { unit: "in" as const, format: "a4" as const, orientation: "portrait" as const },
    };
    
    html2pdf().set(opt).from(wrapper).save().then(() => {
      document.body.removeChild(wrapper);
      toast.success("PDF exportado com sucesso!");
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (analysisNotFound) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
              <Github className="w-6 h-6 text-foreground" />
              <span className="font-semibold text-xl">GitAnalyzer</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                <Home className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/projeto/${id}`)}>
                <Grid3X3 className="w-4 h-4 mr-2" />
                Análises
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className={`w-20 h-20 ${iconBgColor} rounded-full flex items-center justify-center mx-auto`}>
              <AlertCircle className={`w-10 h-10 ${iconColor}`} />
            </div>
            <h2 className="text-2xl font-bold">{title}</h2>
            <p className="text-muted-foreground">
              Esta análise ainda não foi gerada para o projeto <strong>{project?.name}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              Isso pode acontecer se o projeto foi analisado antes da atualização do sistema ou se houve um erro durante a geração.
            </p>
            <div className="flex flex-col gap-3 pt-4">
              <Button 
                onClick={handleRegenerateAnalysis} 
                disabled={regenerating}
                className="gap-2"
              >
                {regenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Gerar {title}
              </Button>
              <Button variant="outline" onClick={() => navigate(`/projeto/${id}`)}>
                Voltar para Análises
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <Github className="w-6 h-6 text-foreground" />
            <span className="font-semibold text-xl">GitAnalyzer</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/projeto/${id}`)}>
              <Grid3X3 className="w-4 h-4 mr-2" />
              Análises
            </Button>
            {canExportPDF ? (
              <Button variant="outline" size="sm" onClick={exportToPDF}>
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" disabled className="opacity-50">
                      <Lock className="w-4 h-4 mr-2" />
                      PDF
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Faça upgrade para exportar em PDF</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/projeto/${id}`}>{project?.name}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header with icon */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl ${iconBgColor} flex items-center justify-center`}>
              <Icon className={`w-7 h-7 ${iconColor}`} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{title}</h1>
              <p className="text-muted-foreground">{project?.name}</p>
            </div>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                  <Info className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p>💡 Dica: Passe o mouse sobre os títulos para ver o botão de copiar seção</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Viability Score - Only for PRD */}
        {type === "prd" && analysis?.content && (
          <ViabilityScore 
            content={analysis.content} 
            className="mb-6 animate-slide-up"
          />
        )}

        {/* Analysis Content */}
        <div 
          id="analysis-content" 
          className="prose prose-slate dark:prose-invert max-w-none bg-card border border-border rounded-xl p-8 shadow-sm markdown-content animate-slide-up"
        >
          <CheckableMarkdown content={analysis?.content || "Nenhuma análise disponível."} />
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8">
          {prevRoute ? (
            <Button variant="outline" onClick={() => navigate(`${prevRoute.path}/${id}`)}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              {prevRoute.label}
            </Button>
          ) : (
            <div />
          )}
          
          {nextRoute ? (
            <Button variant="outline" onClick={() => navigate(`${nextRoute.path}/${id}`)}>
              {nextRoute.label}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate(`/projeto/${id}`)}>
              Ver Todas as Análises
              <Grid3X3 className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default AnalysisPageLayout;
