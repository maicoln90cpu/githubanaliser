import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Github, FileText, DollarSign, Lightbulb, Home, Loader2, Download, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import html2pdf from "html2pdf.js";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const FundingPlan = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      const { data: analysisData, error: analysisError } = await supabase
        .from("analyses")
        .select("*")
        .eq("project_id", id)
        .eq("type", "captacao")
        .single();

      if (analysisError) throw analysisError;
      setAnalysis(analysisData);

      toast.success("Análise carregada com sucesso", {
        icon: <CheckCircle className="w-4 h-4 text-accent" />,
      });

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar análise");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    const element = document.getElementById("analysis-content");
    const options = {
      margin: 1,
      filename: `${project?.name || "projeto"}-Captacao.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in" as const, format: "letter" as const, orientation: "portrait" as const },
    };
    html2pdf().set(options).from(element).save();
    toast.success("PDF gerado com sucesso!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <Home className="w-5 h-5" />
            </Button>
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Github className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">{project?.name}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportToPDF}>
              <Download className="w-4 h-4" />
              Exportar PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/analise-prd/${id}`)}>
              <FileText className="w-4 h-4" />
              PRD
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/melhorias-features/${id}`)}>
              <Lightbulb className="w-4 h-4" />
              Melhorias
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="space-y-8 animate-fade-in">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => navigate("/")} className="cursor-pointer">
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => navigate("/historico")} className="cursor-pointer">
                  {project?.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Plano de Captação</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent-light rounded-full text-accent font-medium text-sm">
              <DollarSign className="w-4 h-4" />
              Plano de Captação
            </div>
            <h1 className="text-4xl font-bold">Estratégia de Marketing & Copy</h1>
            <p className="text-lg text-muted-foreground">
              Como divulgar e captar recursos para {project?.name}
            </p>
          </div>

          <div id="analysis-content" className="prose prose-slate max-w-none bg-card border border-border rounded-xl p-8 shadow-sm markdown-content">
            <ReactMarkdown>
              {analysis?.content || "Nenhuma análise disponível."}
            </ReactMarkdown>
          </div>

          <div className="flex justify-between pt-8 border-t border-border">
            <Button variant="outline" onClick={() => navigate(`/analise-prd/${id}`)}>
              Voltar: Análise PRD
            </Button>
            <Button onClick={() => navigate(`/melhorias-features/${id}`)}>
              Próximo: Melhorias
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FundingPlan;
