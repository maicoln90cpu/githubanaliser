import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Github, Check, Circle, AlertCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ANALYSIS_TYPES, ANALYSIS_TYPE_SLUGS, type AnalysisTypeSlug } from "@/lib/analysisTypes";

interface Step {
  id: string;
  label: string;
  status: "pending" | "loading" | "complete" | "error";
  analysisType?: string;
}

interface QueueItem {
  id: string;
  analysis_type: string;
  status: string;
  error_message?: string;
}

// Build steps dynamically from centralized definitions
const buildAllSteps = (): Step[] => {
  const steps: Step[] = [
    { id: "connect", label: "Conectando ao GitHub", status: "pending" },
    { id: "structure", label: "Extraindo estrutura do projeto", status: "pending" },
  ];
  
  // Add analysis steps from centralized definitions
  for (const slug of ANALYSIS_TYPE_SLUGS) {
    const type = ANALYSIS_TYPES[slug];
    steps.push({
      id: slug,
      label: type.stepLabel,
      status: "pending",
      analysisType: slug,
    });
  }
  
  steps.push({ id: "complete", label: "Finalizando análise", status: "pending" });
  
  return steps;
};

const allSteps = buildAllSteps();

const Analyzing = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [progress, setProgress] = useState(0);
  const [startTime] = useState(Date.now());
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>("~2min");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [currentAnalysisType, setCurrentAnalysisType] = useState<string | null>(null);
  
  const analysisStartedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const hasCompletedRef = useRef(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Stale detection refs
  const staleStartTimeRef = useRef<number | null>(null);
  const lastProgressRef = useRef<number>(0);
  const pollFailCountRef = useRef<number>(0);
  const globalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const githubUrl = searchParams.get("url");
  const existingProjectId = searchParams.get("projectId");
  const analysisTypesParam = searchParams.get("analysisTypes");
  const useCacheParam = searchParams.get("useCache") === "true";
  const depthParam = searchParams.get("depth") || "complete";
  
  // Parse selected analysis types
  const selectedAnalysisTypes = useMemo(() => {
    if (analysisTypesParam) {
      return analysisTypesParam.split(",");
    }
    return ["prd", "divulgacao", "captacao", "seguranca", "ui_theme", "ferramentas", "features", "documentacao"];
  }, [analysisTypesParam]);

  // Build dynamic steps based on selected analyses
  const dynamicSteps = useMemo(() => {
    const steps: Step[] = [
      { id: "connect", label: "Conectando ao GitHub", status: "pending" },
      { id: "structure", label: "Extraindo estrutura do projeto", status: "pending" },
    ];
    
    for (const step of allSteps) {
      if (step.analysisType && selectedAnalysisTypes.includes(step.analysisType)) {
        steps.push({ ...step, status: "pending" });
      }
    }
    
    steps.push({ id: "complete", label: "Finalizando análise", status: "pending" });
    
    return steps;
  }, [selectedAnalysisTypes]);

  const [steps, setSteps] = useState<Step[]>(dynamicSteps);

  useEffect(() => {
    setSteps(dynamicSteps);
  }, [dynamicSteps]);

  const calculateTimeRemaining = useCallback((completedCount: number, totalCount: number) => {
    const elapsed = Date.now() - startTime;
    if (completedCount <= 0) return "~2min";
    
    const avgTimePerItem = elapsed / completedCount;
    const remainingItems = totalCount - completedCount;
    const remainingMs = avgTimePerItem * remainingItems;
    
    if (remainingMs < 1000) return "quase pronto...";
    if (remainingMs < 60000) return `~${Math.ceil(remainingMs / 1000)}s`;
    return `~${Math.ceil(remainingMs / 60000)}min`;
  }, [startTime]);

  // Process next item in queue with stale detection
  const processNextQueueItem = useCallback(async (projId: string) => {
    if (hasCompletedRef.current) return;

    // If processing for too long, reset the flag
    if (isProcessingRef.current) {
      pollFailCountRef.current += 1;
      console.log(`[Polling] Processing flag still true, fail count: ${pollFailCountRef.current}`);
      
      // After 3 consecutive fails (6 seconds), force reset
      if (pollFailCountRef.current >= 3) {
        console.log("[Polling] Forcing isProcessingRef reset after consecutive fails");
        isProcessingRef.current = false;
        pollFailCountRef.current = 0;
      } else {
        return;
      }
    }

    try {
      // Get pending queue items
      const { data: queueItems, error: queueError } = await supabase
        .from("analysis_queue")
        .select("*")
        .eq("project_id", projId)
        .order("created_at", { ascending: true });

      if (queueError) {
        console.error("[Queue] Erro ao buscar fila:", queueError);
        pollFailCountRef.current += 1;
        return;
      }

      // Reset fail count on successful query
      pollFailCountRef.current = 0;

      const pendingItems = queueItems?.filter(item => item.status === "pending") || [];
      const completedItems = queueItems?.filter(item => item.status === "completed") || [];
      const processingItems = queueItems?.filter(item => item.status === "processing") || [];
      const totalItems = queueItems?.length || 0;

      // Update progress
      const completedCount = completedItems.length;
      const progressPercent = Math.round(((completedCount + 2) / (totalItems + 3)) * 100);
      
      // Stale detection: check if progress hasn't changed
      if (progressPercent === lastProgressRef.current && progressPercent < 100) {
        if (!staleStartTimeRef.current) {
          staleStartTimeRef.current = Date.now();
          console.log(`[Polling] Progress stale at ${progressPercent}%, starting timer`);
        } else {
          const staleTime = Date.now() - staleStartTimeRef.current;
          if (staleTime > 30000) {
            console.log(`[Polling] Progress stale for ${staleTime}ms, forcing refresh`);
            staleStartTimeRef.current = null;
            isProcessingRef.current = false;
          }
        }
      } else {
        // Progress changed, reset stale timer
        if (staleStartTimeRef.current) {
          console.log(`[Polling] Progress changed to ${progressPercent}%, resetting stale timer`);
        }
        staleStartTimeRef.current = null;
        lastProgressRef.current = progressPercent;
      }
      
      setProgress(progressPercent);
      setEstimatedTimeRemaining(calculateTimeRemaining(completedCount, totalItems));

      // Update steps based on queue status
      setSteps(prev => prev.map(step => {
        if (step.id === "connect") return { ...step, status: "complete" };
        if (step.id === "structure") return { ...step, status: "complete" };
        if (step.id === "complete") {
          if (pendingItems.length === 0 && processingItems.length === 0) {
            return { ...step, status: "complete" };
          }
          return { ...step, status: "pending" };
        }
        
        if (step.analysisType) {
          const queueItem = queueItems?.find(q => q.analysis_type === step.analysisType);
          if (queueItem) {
            if (queueItem.status === "completed") return { ...step, status: "complete" };
            if (queueItem.status === "processing") return { ...step, status: "loading" };
            if (queueItem.status === "error") return { ...step, status: "error" };
          }
        }
        return step;
      }));

      // Check if all done
      if (pendingItems.length === 0 && processingItems.length === 0) {
        if (!hasCompletedRef.current) {
          hasCompletedRef.current = true;
          console.log("[Polling] All items completed, navigating to project");
          
          // Update project status
          await supabase
            .from("projects")
            .update({ analysis_status: "completed" })
            .eq("id", projId);
          
          setProgress(100);
          toast.success("Análise concluída!");
          
          setTimeout(() => {
            navigate(`/projeto/${projId}`);
          }, 500);
        }
        return;
      }

      // If something is already processing in the database, just wait
      if (processingItems.length > 0) {
        setCurrentAnalysisType(processingItems[0].analysis_type);
        console.log(`[Polling] Item ${processingItems[0].analysis_type} still processing in DB`);
        return;
      }

      // Process next pending item with timeout
      if (pendingItems.length > 0) {
        isProcessingRef.current = true;
        const nextItem = pendingItems[0];
        setCurrentAnalysisType(nextItem.analysis_type);
        
        console.log(`[Queue] Processando: ${nextItem.analysis_type}`);
        
        try {
          // Create AbortController for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
          
          const { data, error } = await supabase.functions.invoke("process-single-analysis", {
            body: { queueItemId: nextItem.id }
          });
          
          clearTimeout(timeoutId);

          if (error) {
            console.error(`[Queue] Erro ao processar ${nextItem.analysis_type}:`, error);
          } else {
            console.log(`[Queue] Concluído: ${nextItem.analysis_type}`);
          }
        } catch (e) {
          console.error(`[Queue] Exceção ao processar ${nextItem.analysis_type}:`, e);
        }
        
        isProcessingRef.current = false;
      }
    } catch (error) {
      console.error("[Queue] Erro geral:", error);
      isProcessingRef.current = false;
      pollFailCountRef.current += 1;
    }
  }, [calculateTimeRemaining, navigate]);

  // Poll and process queue with global timeout
  useEffect(() => {
    if (!projectId || hasCompletedRef.current) return;

    console.log(`[Polling] Starting polling for project ${projectId}`);
    
    // Reset refs when starting new polling session
    staleStartTimeRef.current = null;
    lastProgressRef.current = 0;
    pollFailCountRef.current = 0;
    isProcessingRef.current = false;

    // Initial check immediately
    processNextQueueItem(projectId);

    // Poll every 2 seconds
    pollingRef.current = setInterval(() => {
      processNextQueueItem(projectId);
    }, 2000);

    // Global timeout: 10 minutes max for entire analysis
    globalTimeoutRef.current = setTimeout(() => {
      console.log("[Polling] Global timeout reached (10 minutes)");
      if (!hasCompletedRef.current) {
        toast.error("Análise demorou muito tempo. Verifique o status no projeto.");
        if (pollingRef.current) clearInterval(pollingRef.current);
        navigate(`/projeto/${projectId}`);
      }
    }, 600000); // 10 minutes

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (globalTimeoutRef.current) {
        clearTimeout(globalTimeoutRef.current);
      }
    };
  }, [projectId, processNextQueueItem, navigate]);

  // Start analysis - handles both new analysis and ProjectHub flow
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      toast.error("Você precisa estar logado para analisar projetos");
      navigate("/auth");
      return;
    }

    if (!githubUrl && !existingProjectId) {
      toast.error("URL do GitHub não encontrada");
      navigate("/dashboard");
      return;
    }

    const startAnalysis = async () => {
      if (analysisStartedRef.current) {
        console.log("⚠️ Análise já iniciada, ignorando chamada duplicada");
        return;
      }
      analysisStartedRef.current = true;
      
      try {
        // Check if analysis already in progress for this project
        if (existingProjectId) {
          const { data: existingProject } = await supabase
            .from("projects")
            .select("analysis_status")
            .eq("id", existingProjectId)
            .single();

          // If queue is already ready or processing, just poll
          if (existingProject?.analysis_status === "queue_ready" || 
              existingProject?.analysis_status?.startsWith("generating_")) {
            console.log("✓ Análise já em andamento, acompanhando...");
            setSteps(prev => prev.map((step, i) => 
              i <= 1 ? { ...step, status: "complete" } : step
            ));
            setProgress(15);
            setProjectId(existingProjectId);
            return;
          }
        }

        setSteps(prev => prev.map((step, i) => 
          i === 0 ? { ...step, status: "loading" } : step
        ));
        setProgress(5);

        const { data, error } = await supabase.functions.invoke("analyze-github", {
          body: { 
            githubUrl: githubUrl || "", 
            userId: user.id,
            analysisTypes: selectedAnalysisTypes,
            useCache: useCacheParam,
            depth: depthParam,
            existingProjectId: existingProjectId || undefined
          }
        });

        if (error) {
          console.error("Erro ao iniciar análise:", error);
          toast.error("Erro ao iniciar análise");
          analysisStartedRef.current = false;
          navigate("/dashboard");
          return;
        }

        if (!data?.projectId) {
          toast.error("Resposta inválida do servidor");
          analysisStartedRef.current = false;
          navigate("/dashboard");
          return;
        }

        if (data.alreadyInProgress) {
          console.log("✓ Análise já em andamento, acompanhando...");
        }

        setSteps(prev => prev.map((step, i) => 
          i <= 1 ? { ...step, status: i === 1 ? "loading" : "complete" } : step
        ));
        setProgress(10);
        setProjectId(data.projectId);

        // Poll for queue_ready status
        const checkQueueReady = async () => {
          const { data: project } = await supabase
            .from("projects")
            .select("analysis_status")
            .eq("id", data.projectId)
            .single();

          if (project?.analysis_status === "queue_ready" || 
              project?.analysis_status?.startsWith("generating_") ||
              project?.analysis_status === "completed") {
            setSteps(prev => prev.map((step, i) => 
              i <= 1 ? { ...step, status: "complete" } : step
            ));
            setProgress(15);
            return true;
          }
          if (project?.analysis_status === "error") {
            setErrorMessage("Erro ao preparar análise");
            return true;
          }
          return false;
        };

        // Wait for extraction to complete
        let ready = await checkQueueReady();
        let attempts = 0;
        while (!ready && attempts < 60) { // Max 60 seconds waiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          ready = await checkQueueReady();
          attempts++;
        }

        if (!ready) {
          setErrorMessage("Timeout aguardando preparação da análise");
        }

      } catch (error) {
        console.error("Erro:", error);
        toast.error("Erro ao processar análise");
        analysisStartedRef.current = false;
        navigate("/dashboard");
      }
    };

    startAnalysis();

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [githubUrl, navigate, user, authLoading, existingProjectId, selectedAnalysisTypes, useCacheParam, depthParam]);

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

  const handleCancel = async () => {
    setIsCancelling(true);
    
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    try {
      if (projectId) {
        // Cancel pending queue items
        await supabase
          .from("analysis_queue")
          .delete()
          .eq("project_id", projectId)
          .eq("status", "pending");

        const { data: analyses } = await supabase
          .from("analyses")
          .select("id, type")
          .eq("project_id", projectId);

        if (analyses && analyses.length > 0) {
          // Update project status
          await supabase
            .from("projects")
            .update({ analysis_status: "completed" })
            .eq("id", projectId);
          
          toast.info(`Análise cancelada. ${analyses.length} análise(s) já concluída(s) foram salvas.`);
          navigate(`/projeto/${projectId}`);
        } else {
          toast.info("Análise cancelada.");
          navigate("/dashboard");
        }
      } else {
        toast.info("Análise cancelada.");
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Erro ao cancelar:", error);
      toast.error("Erro ao cancelar análise");
      navigate("/dashboard");
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
              className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                step.status === "loading"
                  ? "bg-primary/10 border border-primary/20"
                  : step.status === "complete"
                  ? "bg-muted/50"
                  : step.status === "error"
                  ? "bg-destructive/10"
                  : ""
              }`}
            >
              {getStepIcon(step.status)}
              <span
                className={`text-sm ${
                  step.status === "loading"
                    ? "text-primary font-medium"
                    : step.status === "complete"
                    ? "text-muted-foreground"
                    : step.status === "error"
                    ? "text-destructive"
                    : "text-muted-foreground/60"
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-4">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={isCancelling}
            className="gap-2"
          >
            {isCancelling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            Cancelar análise
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Análises já concluídas serão mantidas
          </p>
        </div>
      </div>
    </div>
  );
};

export default Analyzing;
