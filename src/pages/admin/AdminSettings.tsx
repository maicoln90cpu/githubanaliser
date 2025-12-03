import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertCircle,
  Save,
  Crown,
  Layers
} from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

interface SystemSetting {
  key: string;
  value: string;
  description: string | null;
  updated_at: string | null;
}

interface DepthConfig {
  context: number;
  model: string;
}

interface PlanDepthConfig {
  planId: string;
  planName: string;
  allowedDepths: string[];
}

const AdminSettings = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'economic' | 'detailed'>('detailed');
  
  // Depth configurations
  const [criticalConfig, setCriticalConfig] = useState<DepthConfig>({ context: 8000, model: 'google/gemini-2.5-flash-lite' });
  const [balancedConfig, setBalancedConfig] = useState<DepthConfig>({ context: 20000, model: 'google/gemini-2.5-flash-lite' });
  const [completeConfig, setCompleteConfig] = useState<DepthConfig>({ context: 40000, model: 'google/gemini-2.5-flash' });
  
  // Plan depth access
  const [planDepths, setPlanDepths] = useState<PlanDepthConfig[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    if (adminLoading) return;

    if (!isAdmin) {
      toast.error("Acesso negado. Área restrita para administradores.");
      navigate("/dashboard");
      return;
    }

    loadSettings();
  }, [isAdmin, adminLoading, navigate]);

  const loadSettings = async () => {
    try {
      // Load system settings
      const { data: settings } = await supabase
        .from("system_settings")
        .select("*");

      settings?.forEach((setting: SystemSetting) => {
        if (setting.key === 'analysis_mode') {
          setAnalysisMode(setting.value as 'economic' | 'detailed');
        } else if (setting.key === 'depth_critical') {
          try { setCriticalConfig(JSON.parse(setting.value)); } catch {}
        } else if (setting.key === 'depth_balanced') {
          try { setBalancedConfig(JSON.parse(setting.value)); } catch {}
        } else if (setting.key === 'depth_complete') {
          try { setCompleteConfig(JSON.parse(setting.value)); } catch {}
        }
      });

      // Load plans
      const { data: plansData } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("price_monthly", { ascending: true });

      setPlans(plansData || []);

      // Default plan depths based on plan
      const defaultPlanDepths: PlanDepthConfig[] = (plansData || []).map(p => ({
        planId: p.id,
        planName: p.name,
        allowedDepths: p.slug === 'free' ? ['critical'] : 
                       p.slug === 'basic' ? ['critical', 'balanced'] : 
                       ['critical', 'balanced', 'complete'],
      }));

      // Check if we have saved plan depths
      const planDepthSetting = settings?.find(s => s.key === 'plan_depths');
      if (planDepthSetting) {
        try {
          const savedDepths = JSON.parse(planDepthSetting.value);
          setPlanDepths(defaultPlanDepths.map(pd => {
            const saved = savedDepths.find((s: any) => s.planId === pd.planId);
            return saved || pd;
          }));
        } catch {
          setPlanDepths(defaultPlanDepths);
        }
      } else {
        setPlanDepths(defaultPlanDepths);
      }

    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

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

  const saveDepthConfig = async (depth: string, config: DepthConfig) => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("key")
        .eq("key", `depth_${depth}`)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("system_settings")
          .update({ 
            value: JSON.stringify(config), 
            updated_by: user?.id,
            updated_at: new Date().toISOString()
          })
          .eq("key", `depth_${depth}`);
      } else {
        await supabase
          .from("system_settings")
          .insert({ 
            key: `depth_${depth}`,
            value: JSON.stringify(config),
            description: `Configuração do nível ${depth}`,
            updated_by: user?.id
          });
      }

      toast.success(`Configuração ${depth} salva`);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const savePlanDepths = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("key")
        .eq("key", "plan_depths")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("system_settings")
          .update({ 
            value: JSON.stringify(planDepths), 
            updated_by: user?.id,
            updated_at: new Date().toISOString()
          })
          .eq("key", "plan_depths");
      } else {
        await supabase
          .from("system_settings")
          .insert({ 
            key: "plan_depths",
            value: JSON.stringify(planDepths),
            description: "Configuração de profundidades por plano",
            updated_by: user?.id
          });
      }

      toast.success("Configurações de planos salvas");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const togglePlanDepth = (planId: string, depth: string) => {
    setPlanDepths(prev => prev.map(pd => {
      if (pd.planId !== planId) return pd;
      
      const hasDepth = pd.allowedDepths.includes(depth);
      return {
        ...pd,
        allowedDepths: hasDepth
          ? pd.allowedDepths.filter(d => d !== depth)
          : [...pd.allowedDepths, depth],
      };
    }));
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

      <main className="container mx-auto px-4 py-8 max-w-4xl">
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
              <h2 className="text-xl font-semibold mb-1">Modo de Análise Global</h2>
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
            <div className={`p-4 rounded-lg border-2 transition-all ${isEconomic ? 'border-green-500 bg-green-500/5' : 'border-border bg-muted/30'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEconomic ? 'bg-green-500/20' : 'bg-muted'}`}>
                  <Zap className={`w-4 h-4 ${isEconomic ? 'text-green-500' : 'text-muted-foreground'}`} />
                </div>
                <h3 className="font-semibold">Modo Econômico</h3>
                {isEconomic && (
                  <Badge className="bg-green-500/20 text-green-500">Ativo</Badge>
                )}
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span>~60-70% mais barato</span>
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-500" />
                  <span>Análises mais rápidas</span>
                </li>
              </ul>
            </div>

            <div className={`p-4 rounded-lg border-2 transition-all ${!isEconomic ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!isEconomic ? 'bg-primary/20' : 'bg-muted'}`}>
                  <BookOpen className={`w-4 h-4 ${!isEconomic ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <h3 className="font-semibold">Modo Detalhado</h3>
                {!isEconomic && (
                  <Badge className="bg-primary/20 text-primary">Ativo</Badge>
                )}
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span>Análises mais completas</span>
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>Maior contexto processado</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Depth Configurations */}
        <div className="p-6 bg-card border border-border rounded-xl mb-6 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2 mb-6">
            <Layers className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Configuração de Profundidades</h2>
          </div>

          <div className="space-y-6">
            {/* Critical */}
            <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/20 text-green-500">Critical</Badge>
                  <span className="text-sm text-muted-foreground">Análise rápida e econômica</span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => saveDepthConfig('critical', criticalConfig)}
                  disabled={saving}
                >
                  <Save className="w-4 h-4 mr-1" />
                  Salvar
                </Button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Contexto Máximo (chars)</Label>
                  <Input
                    type="number"
                    value={criticalConfig.context}
                    onChange={(e) => setCriticalConfig(prev => ({ ...prev, context: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label>Modelo</Label>
                  <Input
                    value={criticalConfig.model}
                    onChange={(e) => setCriticalConfig(prev => ({ ...prev, model: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Balanced */}
            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/20 text-blue-500">Balanced</Badge>
                  <span className="text-sm text-muted-foreground">Equilíbrio entre custo e qualidade</span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => saveDepthConfig('balanced', balancedConfig)}
                  disabled={saving}
                >
                  <Save className="w-4 h-4 mr-1" />
                  Salvar
                </Button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Contexto Máximo (chars)</Label>
                  <Input
                    type="number"
                    value={balancedConfig.context}
                    onChange={(e) => setBalancedConfig(prev => ({ ...prev, context: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label>Modelo</Label>
                  <Input
                    value={balancedConfig.model}
                    onChange={(e) => setBalancedConfig(prev => ({ ...prev, model: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Complete */}
            <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-500/20 text-purple-500">Complete</Badge>
                  <span className="text-sm text-muted-foreground">Análise completa e detalhada</span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => saveDepthConfig('complete', completeConfig)}
                  disabled={saving}
                >
                  <Save className="w-4 h-4 mr-1" />
                  Salvar
                </Button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Contexto Máximo (chars)</Label>
                  <Input
                    type="number"
                    value={completeConfig.context}
                    onChange={(e) => setCompleteConfig(prev => ({ ...prev, context: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label>Modelo</Label>
                  <Input
                    value={completeConfig.model}
                    onChange={(e) => setCompleteConfig(prev => ({ ...prev, model: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Plan Depth Access */}
        <div className="p-6 bg-card border border-border rounded-xl mb-6 animate-slide-up" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              <h2 className="text-xl font-semibold">Profundidades por Plano</h2>
            </div>
            <Button 
              onClick={savePlanDepths}
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              Salvar Configurações
            </Button>
          </div>

          <div className="space-y-4">
            {planDepths.map((pd) => (
              <div key={pd.planId} className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{pd.planName}</span>
                    <span className="text-xs text-muted-foreground">
                      ({pd.allowedDepths.length} profundidades)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {['critical', 'balanced', 'complete'].map((depth) => (
                      <button
                        key={depth}
                        onClick={() => togglePlanDepth(pd.planId, depth)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          pd.allowedDepths.includes(depth)
                            ? depth === 'critical' ? 'bg-green-500/20 text-green-500 border border-green-500/30' :
                              depth === 'balanced' ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30' :
                              'bg-purple-500/20 text-purple-500 border border-purple-500/30'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        {depth.charAt(0).toUpperCase() + depth.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-yellow-600">Nota:</strong> Usuários só poderão selecionar as profundidades 
              permitidas pelo seu plano atual. Admins têm acesso a todas as profundidades.
            </p>
          </div>
        </div>

        {/* Cost Estimation */}
        <div className="p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <h3 className="font-semibold text-lg mb-4">Estimativa de Custos por Profundidade</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4">Profundidade</th>
                  <th className="text-right py-3 px-4">Contexto</th>
                  <th className="text-right py-3 px-4">Modelo</th>
                  <th className="text-right py-3 px-4">Custo Est./Análise</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4">
                    <Badge className="bg-green-500/20 text-green-500">Critical</Badge>
                  </td>
                  <td className="text-right py-3 px-4">{criticalConfig.context.toLocaleString()}</td>
                  <td className="text-right py-3 px-4 text-xs font-mono">{criticalConfig.model.split('/')[1]}</td>
                  <td className="text-right py-3 px-4 text-green-500">~R$ 0.01</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4">
                    <Badge className="bg-blue-500/20 text-blue-500">Balanced</Badge>
                  </td>
                  <td className="text-right py-3 px-4">{balancedConfig.context.toLocaleString()}</td>
                  <td className="text-right py-3 px-4 text-xs font-mono">{balancedConfig.model.split('/')[1]}</td>
                  <td className="text-right py-3 px-4">~R$ 0.03</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4">
                    <Badge className="bg-purple-500/20 text-purple-500">Complete</Badge>
                  </td>
                  <td className="text-right py-3 px-4">{completeConfig.context.toLocaleString()}</td>
                  <td className="text-right py-3 px-4 text-xs font-mono">{completeConfig.model.split('/')[1]}</td>
                  <td className="text-right py-3 px-4">~R$ 0.08</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminSettings;
