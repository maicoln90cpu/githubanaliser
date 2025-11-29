import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Github } from "lucide-react";
import { toast } from "sonner";

const Analyzing = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Extraindo informações do GitHub...");
  const githubUrl = searchParams.get("url");

  useEffect(() => {
    if (!githubUrl) {
      toast.error("URL do GitHub não encontrada");
      navigate("/");
      return;
    }

    const analyzeProject = async () => {
      try {
        setStatus("Extraindo informações do GitHub...");
        
        // Chamar edge function para análise
        const { data, error } = await supabase.functions.invoke("analyze-github", {
          body: { githubUrl }
        });

        if (error) {
          console.error("Erro ao analisar:", error);
          toast.error("Erro ao analisar o projeto");
          navigate("/");
          return;
        }

        setStatus("Gerando análises com IA...");

        // Aguardar um pouco para garantir que tudo foi salvo
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Redirecionar para página de análise PRD
        navigate(`/analise-prd/${data.projectId}`);
        
      } catch (error) {
        console.error("Erro:", error);
        toast.error("Erro ao processar análise");
        navigate("/");
      }
    };

    analyzeProject();
  }, [githubUrl, navigate]);

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
          <p className="text-muted-foreground">{status}</p>
          
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Isso pode levar alguns segundos...</span>
          </div>
        </div>

        {/* Progress steps */}
        <div className="space-y-3 pt-8">
          {[
            "Conectando ao GitHub",
            "Extraindo estrutura do projeto",
            "Analisando código-fonte",
            "Gerando análise PRD",
            "Criando plano de captação",
            "Sugerindo melhorias"
          ].map((step, index) => (
            <div
              key={step}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-sm text-muted-foreground">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analyzing;
