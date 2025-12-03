import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Github, Check, Circle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface Step {
  id: string;
  label: string;
  status: "pending" | "loading" | "complete" | "error";
}

type AnalysisStatus = 
  | "pending" 
  | "extracting" 
  | "generating_prd" 
  | "generating_divulgacao"
  | "generating_captacao"
  | "generating_seguranca"
  | "generating_ui"
  | "generating_ferramentas"
  | "generating_features"
  | "completed" 
  | "error";

const statusToStepIndex: Record<AnalysisStatus, number> = {
  pending: 0,
  extracting: 1,
  generating_prd: 2,
  generating_divulgacao: 3,
  generating_captacao: 4,
  generating_seguranca: 5,
  generating_ui: 6,
  generating_ferramentas: 7,
  generating_features: 8,
  completed: 9,
  error: -1,
};

const Analyzing = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [progress, setProgress] = useState(0);
  const [startTime] = useState(Date.now());
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>("~2min");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const hasCompletedRef = useRef(false);
  
  const [steps, setSteps] = useState<Step[]>([
    { id: "connect", label: "Conectando ao GitHub", status: "pending" },
    { id: "structure", label: "Extraindo estrutura do projeto", status: "pending" },
    { id: "prd", label: "Gerando análise PRD", status: "pending" },
    { id: "divulgacao", label: "Criando plano de divulgação", status: "pending" },
    { id: "captacao", label: "Criando plano de captação", status: "pending" },
    { id: "seguranca", label: "Analisando segurança", status: "pending" },
    { id: "ui", label: "Sugerindo melhorias visuais", status: "pending" },
    { id: "ferramentas", label: "Analisando ferramentas", status: "pending" },
    { id: "features", label: "Sugerindo novas features", status: "pending" },
    { id: "complete", label: "Finalizando análise", status: "pending" },
  ]);
  
  const githubUrl = searchParams.get("url");
  const existingProjectId = searchParams.get("projectId");

  const calculateTimeRemaining = (currentStepIndex: number, totalSteps: number) => {
    const elapsed = Date.now() - startTime;
    const completedSteps = currentStepIndex;
    if (completedSteps <= 0) return "~2min";
    
    const avgTimePerStep = elapsed / completedSteps;
    const remainingSteps = totalSteps - completedSteps;
    const remainingMs = avgTimePerStep * remainingSteps;
    
    if (remainingMs < 1000) return "quase pronto...";
    if (remainingMs < 60000) return `~${Math.ceil(remainingMs / 1000)}s`;
    return `~${Math.ceil(remainingMs / 60000)}min`;
  };

  const updateStepsFromStatus = (status: AnalysisStatus) => {
    const stepIndex = statusToStepIndex[status];
    const totalSteps = 10;
    
    setSteps(prev => prev.map((step, i) => {
      if (status === "error") {
        return step;
      }
      if (status === "completed") {
        return { ...step, status: "complete" };
      }
      if (i < stepIndex) {
        return { ...step, status: "complete" };
      }
      if (i === stepIndex) {
        return { ...step, status: "loading" };
      }
      return { ...step, status: "pending" };
    }));

    if (status === "completed") {
      setProgress(100);
    } else if (stepIndex >= 0) {
      setProgress(Math.round(((stepIndex + 0.5) / totalSteps) * 100));
      setEstimatedTimeRemaining(calculateTimeRemaining(stepIndex, totalSteps));
    }
  };

  const pollStatus = async (id: string) => {
    try {
      const { data: project, error } = await supabase
        .from("projects")
        .select("analysis_status, error_message")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erro ao buscar status:", error);
        return;
      }

      const status = project.analysis_status as AnalysisStatus;
      updateStepsFromStatus(status);

      if (status === "completed" && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        toast.success("Análise concluída!");
        setTimeout(() => {
          navigate(`/projeto/${id}`);
        }, 500);
      } else if (status === "error") {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
        setErrorMessage(project.error_message || "Erro desconhecido na análise");
        toast.error("Erro ao analisar o projeto");
      }
    } catch (error) {
      console.error("Erro no polling:", error);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      toast.error("Você precisa estar logado para analisar projetos");
      navigate("/auth");
      return;
    }

    if (existingProjectId) {
      setProjectId(existingProjectId);
      setSteps(prev => prev.map((step, i) => 
        i === 0 ? { ...step, status: "complete" } : step
      ));
      setProgress(10);
      
      pollingRef.current = setInterval(() => {
        pollStatus(existingProjectId);
      }, 3000);
      
      pollStatus(existingProjectId);
      
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }

    if (!githubUrl) {
      toast.error("URL do GitHub não encontrada");
      navigate("/dashboard");
      return;
    }

    const startAnalysis = async () => {
      try {
        setSteps(prev => prev.map((step, i) => 
          i === 0 ? { ...step, status: "loading" } : step
        ));
        setProgress(5);

        const { data, error } = await supabase.functions.invoke("analyze-github", {
          body: { githubUrl, userId: user.id }
        });

        if (error) {
          console.error("Erro ao iniciar análise:", error);
          toast.error("Erro ao iniciar análise");
          navigate("/dashboard");
          return;
        }

        if (!data?.projectId) {
          toast.error("Resposta inválida do servidor");
          navigate("/dashboard");
          return;
        }

        setSteps(prev => prev.map((step, i) => 
          i === 0 ? { ...step, status: "complete" } : step
        ));
        setProgress(10);

        setProjectId(data.projectId);

        pollingRef.current = setInterval(() => {
          pollStatus(data.projectId);
        }, 3000);

        pollStatus(data.projectId);

      } catch (error) {
        console.error("Erro:", error);
        toast.error("Erro ao processar análise");
        navigate("/dashboard");
      }
    };

    startAnalysis();

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [githubUrl, navigate, user, authLoading, existingProjectId]);

  const getStepIcon = (status: Step["status"]) => {
    switch (status) {
      case "complete":
        return <Check className="w-4 h-4 text-primary" />;
      case "loading":
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground/40" />;
    }
  };

  const currentStep = steps.findIndex(s => s.status === "loading");

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold">Erro na análise</h2>
          <p className="text-muted-foreground">{errorMessage}</p>
          <Button onClick={() => navigate("/dashboard")} variant="outline">
            Voltar ao dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-primary/10 rounded-full animate-ping" />
          </div>
          <div className="relative flex items-center justify-center">
            <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center shadow-xl">
              <Github className="w-12 h-12 text-primary-foreground animate-pulse" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Analisando seu projeto</h2>
          <p className="text-muted-foreground">
            {currentStep >= 0 ? steps[currentStep]?.label : "Processando..."}
          </p>
          
          <div className="px-4">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-muted-foreground">{progress}% concluído</p>
              <p className="text-xs text-muted-foreground">Tempo restante: {estimatedTimeRemaining}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-4 max-h-[400px] overflow-y-auto">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                step.status === "loading" 
                  ? "bg-primary/10 border border-primary/20" 
                  : step.status === "complete"
                  ? "bg-muted/30"
                  : "bg-muted/10"
              }`}
            >
              <div className="flex-shrink-0">
                {getStepIcon(step.status)}
              </div>
              <span className={`text-sm transition-colors ${
                step.status === "loading" 
                  ? "text-foreground font-medium" 
                  : step.status === "complete"
                  ? "text-muted-foreground"
                  : "text-muted-foreground/60"
              }`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analyzing;
