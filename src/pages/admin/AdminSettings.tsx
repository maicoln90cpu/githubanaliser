import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Github, 
  Home, 
  Loader2, 
  Settings,
  ArrowLeft,
  Zap,
  BookOpen,
  DollarSign,
  Clock,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";

interface SystemSetting {
  key: string;
  value: string;
  description: string | null;
  updated_at: string | null;
}

const AdminSettings = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'economic' | 'detailed'>('detailed');
  const [economicMaxContext, setEconomicMaxContext] = useState(15000);
  const [detailedMaxContext, setDetailedMaxContext] = useState(40000);

  useEffect(() => {
    if (adminLoading) return;

    if (!isAdmin) {
      toast.error("Acesso negado. Área restrita para administradores.");
      navigate("/dashboard");
      return;
    }

    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("system_settings")
          .select("*");

        if (error) throw error;

        data?.forEach((setting: SystemSetting) => {
          if (setting.key === 'analysis_mode') {
            setAnalysisMode(setting.value as 'economic' | 'detailed');
          } else if (setting.key === 'economic_max_context') {
            setEconomicMaxContext(parseInt(setting.value) || 15000);
          } else if (setting.key === 'detailed_max_context') {
            setDetailedMaxContext(parseInt(setting.value) || 40000);
          }
        });
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
        toast.error("Erro ao carregar configurações");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [isAdmin, adminLoading, navigate]);

  const handleModeToggle = async (isDetailed: boolean) => {
    const newMode = isDetailed ? 'detailed' : 'economic';
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from("system_settings")
        .update({ 
          value: newMode, 
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq("key", "analysis_mode");

      if (error) throw error;

      setAnalysisMode(newMode);
      toast.success(`Modo ${newMode === 'detailed' ? 'Detalhado' : 'Econômico'} ativado`);
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isEconomic = analysisMode === 'economic';

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
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
          </div>
          <p className="text-muted-foreground">
            Gerencie as configurações globais da aplicação
          </p>
        </div>

        {/* Mode Toggle Card */}
        <div className="p-6 bg-card border border-border rounded-xl mb-6 animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">Modo de Análise</h2>
              <p className="text-sm text-muted-foreground">
                Alterne entre modo econômico (mais barato) e detalhado (mais completo)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${!isEconomic ? 'text-muted-foreground' : 'text-green-500'}`}>
                Econômico
              </span>
              <Switch
                checked={!isEconomic}
                onCheckedChange={handleModeToggle}
                disabled={saving}
              />
              <span className={`text-sm font-medium ${isEconomic ? 'text-muted-foreground' : 'text-primary'}`}>
                Detalhado
              </span>
            </div>
          </div>

          {/* Mode Comparison */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Economic Mode */}
            <div className={`p-4 rounded-lg border-2 transition-all ${isEconomic ? 'border-green-500 bg-green-500/5' : 'border-border bg-muted/30'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEconomic ? 'bg-green-500/20' : 'bg-muted'}`}>
                  <Zap className={`w-4 h-4 ${isEconomic ? 'text-green-500' : 'text-muted-foreground'}`} />
                </div>
                <h3 className="font-semibold">Modo Econômico</h3>
                {isEconomic && (
                  <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-500 rounded-full">
                    Ativo
                  </span>
                )}
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span>Modelo: <code className="bg-muted px-1 rounded">gemini-2.5-flash-lite</code></span>
                </li>
                <li className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-green-500" />
                  <span>Contexto: até {economicMaxContext.toLocaleString()} chars</span>
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-500" />
                  <span>~60-70% mais barato</span>
                </li>
              </ul>
            </div>

            {/* Detailed Mode */}
            <div className={`p-4 rounded-lg border-2 transition-all ${!isEconomic ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!isEconomic ? 'bg-primary/20' : 'bg-muted'}`}>
                  <BookOpen className={`w-4 h-4 ${!isEconomic ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <h3 className="font-semibold">Modo Detalhado</h3>
                {!isEconomic && (
                  <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                    Ativo
                  </span>
                )}
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span>Modelo: <code className="bg-muted px-1 rounded">gemini-2.5-flash</code></span>
                </li>
                <li className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span>Contexto: até {detailedMaxContext.toLocaleString()} chars</span>
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>Análises mais completas</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Cost Estimation */}
        <div className="p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <h3 className="font-semibold text-lg mb-4">Estimativa de Custos por Modo</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4">Cenário</th>
                  <th className="text-right py-3 px-4">Modo Econômico</th>
                  <th className="text-right py-3 px-4">Modo Detalhado</th>
                  <th className="text-right py-3 px-4">Economia</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4">1 análise completa (7 tipos)</td>
                  <td className="text-right py-3 px-4 text-green-500">~$0.005</td>
                  <td className="text-right py-3 px-4">~$0.014</td>
                  <td className="text-right py-3 px-4 text-green-500">~64%</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4">100 usuários/mês (5 projetos cada)</td>
                  <td className="text-right py-3 px-4 text-green-500">~$2.50</td>
                  <td className="text-right py-3 px-4">~$7.00</td>
                  <td className="text-right py-3 px-4 text-green-500">~64%</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4">1.000 usuários/mês</td>
                  <td className="text-right py-3 px-4 text-green-500">~$25.00</td>
                  <td className="text-right py-3 px-4">~$70.00</td>
                  <td className="text-right py-3 px-4 text-green-500">~64%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-yellow-600">Nota:</strong> O modo econômico usa um modelo mais leve e menos contexto, 
              o que pode resultar em análises menos detalhadas. Recomendado para testes ou alta demanda.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminSettings;
