import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Github, Check, Circle } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface Step {
  id: string;
  label: string;
  status: "pending" | "loading" | "complete";
}

const Analyzing = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<Step[]>([
    { id: "connect", label: "Conectando ao GitHub", status: "pending" },
    { id: "structure", label: "Extraindo estrutura do projeto", status: "pending" },
    { id: "code", label: "Analisando código-fonte", status: "pending" },
    { id: "prd", label: "Gerando análise PRD", status: "pending" },
    { id: "funding", label: "Criando plano de captação", status: "pending" },
    { id: "improvements", label: "Sugerindo melhorias", status: "pending" },
  ]);
  const githubUrl = searchParams.get("url");

  const updateStep = (stepIndex: number, status: Step["status"]) => {
    setSteps(prev => prev.map((step, i) => 
      i === stepIndex ? { ...step, status } : step
    ));
    if (status === "loading") {
      setCurrentStep(stepIndex);
      setProgress(Math.round(((stepIndex + 0.5) / 6) * 100));
    } else if (status === "complete") {
      setProgress(Math.round(((stepIndex + 1) / 6) * 100));
    }
  };

  useEffect(() => {
    if (!githubUrl) {
      toast.error("URL do GitHub não encontrada");
      navigate("/");
      return;
    }

    const analyzeProject = async () => {
      try {
        // Step 1: Connecting
        updateStep(0, "loading");
        await new Promise(resolve => setTimeout(resolve, 500));
        updateStep(0, "complete");

        // Step 2: Extracting structure
        updateStep(1, "loading");
        await new Promise(resolve => setTimeout(resolve, 800));
        updateStep(1, "complete");

        // Step 3: Analyzing code
        updateStep(2, "loading");
        
        // Call edge function
        const { data, error } = await supabase.functions.invoke("analyze-github", {
          body: { githubUrl }
        });

        if (error) {
          console.error("Erro ao analisar:", error);
          toast.error("Erro ao analisar o projeto");
          navigate("/");
          return;
        }

        updateStep(2, "complete");

        // Step 4-6: Simulated progress for AI generation (already done in edge function)
        updateStep(3, "loading");
        await new Promise(resolve => setTimeout(resolve, 400));
        updateStep(3, "complete");

        updateStep(4, "loading");
        await new Promise(resolve => setTimeout(resolve, 400));
        updateStep(4, "complete");

        updateStep(5, "loading");
        await new Promise(resolve => setTimeout(resolve, 400));
        updateStep(5, "complete");

        // Redirect
        navigate(`/analise-prd/${data.projectId}`);
        
      } catch (error) {
        console.error("Erro:", error);
        toast.error("Erro ao processar análise");
        navigate("/");
      }
    };

    analyzeProject();
  }, [githubUrl, navigate]);

  const getStepIcon = (status: Step["status"]) => {
    switch (status) {
      case "complete":
        return <Check className="w-4 h-4 text-primary" />;
      case "loading":
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground/40" />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8 animate-fade-in">
        {/* Logo animado */}
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

        {/* Status */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Analisando seu projeto</h2>
          <p className="text-muted-foreground">
            {steps[currentStep]?.label || "Processando..."}
          </p>
          
          {/* Progress bar */}
          <div className="px-4">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">{progress}% concluído</p>
          </div>
        </div>

        {/* Progress steps */}
        <div className="space-y-2 pt-4">
          {steps.map((step, index) => (
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
