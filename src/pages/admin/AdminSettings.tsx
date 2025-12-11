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
  Layers,
  Cpu,
  CheckCircle2,
  Info,
  ShieldAlert
} from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

// OpenAI models and costs (per 1K tokens) - Standard tier pricing
const OPENAI_MODELS = {
  'gpt-5': { name: 'GPT-5', inputCost: 0.00125, outputCost: 0.01 },
  'gpt-5-mini': { name: 'GPT-5 Mini', inputCost: 0.00025, outputCost: 0.002 },
  'gpt-5-nano': { name: 'GPT-5 Nano', inputCost: 0.00005, outputCost: 0.0004 },
  'gpt-4.1': { name: 'GPT-4.1', inputCost: 0.002, outputCost: 0.008 },
  'gpt-4.1-mini': { name: 'GPT-4.1 Mini', inputCost: 0.0004, outputCost: 0.0016 },
  'gpt-4.1-nano': { name: 'GPT-4.1 Nano', inputCost: 0.0001, outputCost: 0.0004 },
  'o3': { name: 'O3', inputCost: 0.002, outputCost: 0.008 },
  'o4-mini': { name: 'O4 Mini', inputCost: 0.0011, outputCost: 0.0044 },
  'gpt-4o': { name: 'GPT-4o', inputCost: 0.0025, outputCost: 0.01 },
  'gpt-4o-mini': { name: 'GPT-4o Mini', inputCost: 0.00015, outputCost: 0.0006 },
};

const AdminSettings = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'economic' | 'detailed'>('detailed');
  
  // AI Provider settings
  const [aiProvider, setAiProvider] = useState<'lovable' | 'openai'>('lovable');
  const [openaiModel, setOpenaiModel] = useState<string>('gpt-5-mini');
  const [openaiKeyConfigured, setOpenaiKeyConfigured] = useState(false);
  
  // Depth configurations
  const [criticalConfig, setCriticalConfig] = useState<DepthConfig>({ context: 8000, model: 'google/gemini-2.5-flash-lite' });
  const [balancedConfig, setBalancedConfig] = useState<DepthConfig>({ context: 20000, model: 'google/gemini-2.5-flash-lite' });
  const [completeConfig, setCompleteConfig] = useState<DepthConfig>({ context: 40000, model: 'google/gemini-2.5-flash' });
  
  // Plan depth access
  const [planDepths, setPlanDepths] = useState<PlanDepthConfig[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  
  // Security settings
  const [signupLimitPerIp, setSignupLimitPerIp] = useState<number>(3);

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
        } else if (setting.key === 'ai_provider') {
          setAiProvider(setting.value as 'lovable' | 'openai');
        } else if (setting.key === 'openai_model') {
          setOpenaiModel(setting.value);
        } else if (setting.key === 'openai_key_configured') {
          setOpenaiKeyConfigured(setting.value === 'true');
        } else if (setting.key === 'depth_critical') {
          try { setCriticalConfig(JSON.parse(setting.value)); } catch {}
        } else if (setting.key === 'depth_balanced') {
          try { setBalancedConfig(JSON.parse(setting.value)); } catch {}
        } else if (setting.key === 'depth_complete') {
          try { setCompleteConfig(JSON.parse(setting.value)); } catch {}
        } else if (setting.key === 'signup_limit_per_ip') {
          setSignupLimitPerIp(parseInt(setting.value) || 3);
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
      // Check if setting exists
      const { data: existing } = await supabase
        .from("system_settings")
        .select("key")
        .eq("key", "analysis_mode")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("system_settings")
          .update({ 
            value: newMode, 
            updated_by: user?.id,
            updated_at: new Date().toISOString()
          })
          .eq("key", "analysis_mode");

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("system_settings")
          .insert({ 
            key: "analysis_mode",
            value: newMode,
            description: "Modo global de análise (economic/detailed)",
            updated_by: user?.id
          });

        if (error) throw error;
      }

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

  const saveAiProvider = async (provider: 'lovable' | 'openai') => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("key")
        .eq("key", "ai_provider")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("system_settings")
          .update({ 
            value: provider, 
            updated_by: user?.id,
            updated_at: new Date().toISOString()
          })
          .eq("key", "ai_provider");
      } else {
        await supabase
          .from("system_settings")
          .insert({ 
            key: "ai_provider",
            value: provider,
            description: "Provider de IA (lovable/openai)",
            updated_by: user?.id
          });
      }

      setAiProvider(provider);
      toast.success(`Provider ${provider === 'lovable' ? 'Lovable AI' : 'OpenAI'} ativado`);
    } catch (error) {
      console.error("Erro ao salvar provider:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const saveOpenaiModel = async (model: string) => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("key")
        .eq("key", "openai_model")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("system_settings")
          .update({ 
            value: model, 
            updated_by: user?.id,
            updated_at: new Date().toISOString()
          })
          .eq("key", "openai_model");
      } else {
        await supabase
          .from("system_settings")
          .insert({ 
            key: "openai_model",
            value: model,
            description: "Modelo OpenAI selecionado",
            updated_by: user?.id
          });
      }

      setOpenaiModel(model);
      toast.success(`Modelo ${OPENAI_MODELS[model as keyof typeof OPENAI_MODELS]?.name || model} selecionado`);
    } catch (error) {
      console.error("Erro ao salvar modelo:", error);
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

        {/* AI Provider Configuration */}
        <div className="p-6 bg-card border border-border rounded-xl mb-6 animate-slide-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center gap-2 mb-6">
            <Cpu className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Provider de IA</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Escolha entre Lovable AI (Gemini) ou OpenAI (GPT). OpenAI requer API Key configurada nos secrets.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Provider Toggle */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => saveAiProvider('lovable')}
              disabled={saving}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                aiProvider === 'lovable' 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border bg-muted/30 hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  aiProvider === 'lovable' ? 'bg-primary/20' : 'bg-muted'
                }`}>
                  <Zap className={`w-4 h-4 ${aiProvider === 'lovable' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <h3 className="font-semibold">Lovable AI</h3>
                {aiProvider === 'lovable' && (
                  <Badge className="bg-primary/20 text-primary">Ativo</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Google Gemini 2.5 Flash</p>
              <p className="text-xs text-muted-foreground mt-1">Mais econômico, ótimo para análises gerais</p>
            </button>

            <button
              onClick={() => saveAiProvider('openai')}
              disabled={saving}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                aiProvider === 'openai' 
                  ? 'border-green-500 bg-green-500/5' 
                  : 'border-border bg-muted/30 hover:border-green-500/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  aiProvider === 'openai' ? 'bg-green-500/20' : 'bg-muted'
                }`}>
                  <Cpu className={`w-4 h-4 ${aiProvider === 'openai' ? 'text-green-500' : 'text-muted-foreground'}`} />
                </div>
                <h3 className="font-semibold">OpenAI</h3>
                {aiProvider === 'openai' && (
                  <Badge className="bg-green-500/20 text-green-500">Ativo</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">GPT-5, GPT-5 Mini, GPT-4.1</p>
              <p className="text-xs text-muted-foreground mt-1">Requer API Key própria</p>
            </button>
          </div>

          {/* OpenAI Configuration */}
          {aiProvider === 'openai' && (
            <div className="space-y-4 p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-600">OPENAI_API_KEY configurada nos secrets</span>
              </div>

              <div>
                <Label>Modelo OpenAI</Label>
                <Select value={openaiModel} onValueChange={saveOpenaiModel} disabled={saving}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OPENAI_MODELS).map(([key, model]) => (
                      <SelectItem key={key} value={key}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* OpenAI Cost Table */}
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Custos OpenAI (por 1K tokens)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3">Modelo</th>
                        <th className="text-right py-2 px-3">Input</th>
                        <th className="text-right py-2 px-3">Output</th>
                        <th className="text-right py-2 px-3">Est. por Análise*</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(OPENAI_MODELS).map(([key, model]) => {
                        // Estimativa: ~2K input + ~2K output por análise
                        const estCost = ((model.inputCost * 2) + (model.outputCost * 2)).toFixed(4);
                        const isSelected = openaiModel === key;
                        return (
                          <tr key={key} className={`border-b border-border/50 ${isSelected ? 'bg-green-500/10' : ''}`}>
                            <td className="py-2 px-3 font-medium">
                              {model.name}
                              {isSelected && <Badge className="ml-2 bg-green-500/20 text-green-500 text-xs">Selecionado</Badge>}
                            </td>
                            <td className="text-right py-2 px-3">${model.inputCost}</td>
                            <td className="text-right py-2 px-3">${model.outputCost}</td>
                            <td className="text-right py-2 px-3 text-green-600">${estCost}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  * Estimativa baseada em ~2K tokens de input e ~2K tokens de output por análise. Custo real pode variar.
                </p>
              </div>
            </div>
          )}

          {aiProvider === 'lovable' && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Custos Lovable AI (Gemini)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3">Modelo</th>
                      <th className="text-right py-2 px-3">Custo Est./Análise</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3">Gemini 2.5 Flash Lite</td>
                      <td className="text-right py-2 px-3 text-primary">~R$ 0.01</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3">Gemini 2.5 Flash</td>
                      <td className="text-right py-2 px-3 text-primary">~R$ 0.02</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Cost Comparison Section */}
        <div className="p-6 bg-card border border-border rounded-xl mb-6 animate-slide-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center gap-2 mb-6">
            <DollarSign className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Comparativo de Custos: Lovable AI vs OpenAI</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Lovable AI Column */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Lovable AI (Gemini)
                </h3>
                <Badge className="bg-green-500/20 text-green-500">Mais Econômico</Badge>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                  <span className="text-sm">Flash Lite (Econômico)</span>
                  <div className="text-right">
                    <span className="text-green-600 font-mono text-sm">~$0.0015</span>
                    <span className="text-muted-foreground text-xs ml-1">/análise</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                  <span className="text-sm">Flash (Detalhado)</span>
                  <div className="text-right">
                    <span className="text-green-600 font-mono text-sm">~$0.003</span>
                    <span className="text-muted-foreground text-xs ml-1">/análise</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-green-500/10 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Custo estimado para 100 análises</div>
                <div className="text-2xl font-bold text-green-600">$0.15 - $0.30</div>
                <div className="text-xs text-muted-foreground">~R$ 0.90 - R$ 1.80</div>
              </div>
            </div>

            {/* OpenAI Column */}
            <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-orange-600 flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  OpenAI
                </h3>
                <Badge className="bg-orange-500/20 text-orange-600">Mais Poderoso</Badge>
              </div>
              
              <div className="space-y-3 max-h-[180px] overflow-y-auto">
                {Object.entries(OPENAI_MODELS).slice(0, 6).map(([key, model]) => {
                  const estCost = ((model.inputCost * 2) + (model.outputCost * 2)).toFixed(4);
                  return (
                    <div key={key} className="flex justify-between items-center p-2 bg-background/50 rounded">
                      <span className="text-sm">{model.name}</span>
                      <div className="text-right">
                        <span className="text-orange-600 font-mono text-sm">${estCost}</span>
                        <span className="text-muted-foreground text-xs ml-1">/análise</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 p-3 bg-orange-500/10 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Custo estimado para 100 análises (GPT-5-mini)</div>
                <div className="text-2xl font-bold text-orange-600">$0.45</div>
                <div className="text-xs text-muted-foreground">~R$ 2.70</div>
              </div>
            </div>
          </div>

          {/* Comparison Summary */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              Resumo Comparativo
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3">Cenário</th>
                    <th className="text-center py-2 px-3">Lovable AI</th>
                    <th className="text-center py-2 px-3">OpenAI (mini)</th>
                    <th className="text-center py-2 px-3">Economia</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-2 px-3">1 análise</td>
                    <td className="text-center py-2 px-3 text-green-600">$0.003</td>
                    <td className="text-center py-2 px-3 text-orange-600">$0.0045</td>
                    <td className="text-center py-2 px-3">
                      <Badge className="bg-green-500/20 text-green-600">33%</Badge>
                    </td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 px-3">100 análises</td>
                    <td className="text-center py-2 px-3 text-green-600">$0.30</td>
                    <td className="text-center py-2 px-3 text-orange-600">$0.45</td>
                    <td className="text-center py-2 px-3">
                      <Badge className="bg-green-500/20 text-green-600">33%</Badge>
                    </td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 px-3">1.000 análises</td>
                    <td className="text-center py-2 px-3 text-green-600">$3.00</td>
                    <td className="text-center py-2 px-3 text-orange-600">$4.50</td>
                    <td className="text-center py-2 px-3">
                      <Badge className="bg-green-500/20 text-green-600">33%</Badge>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">10.000 análises</td>
                    <td className="text-center py-2 px-3 text-green-600">$30.00</td>
                    <td className="text-center py-2 px-3 text-orange-600">$45.00</td>
                    <td className="text-center py-2 px-3">
                      <Badge className="bg-green-500/20 text-green-600">$15 economizados</Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              * Estimativas baseadas em ~2K tokens de input e ~2K tokens de output por análise. 
              Comparação usa Gemini Flash (Lovable AI) vs GPT-5-mini (OpenAI).
            </p>
          </div>
        </div>


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

        {/* Security Settings */}
        <div className="p-6 bg-card border border-border rounded-xl mb-6 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-2 mb-6">
            <ShieldAlert className="w-5 h-5 text-orange-500" />
            <h2 className="text-xl font-semibold">Proteção Anti-Abuse</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Configure limites para prevenir que usuários criem múltiplas contas gratuitas do mesmo IP.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-orange-500/5 border border-orange-500/20 rounded-lg">
              <div className="flex-1">
                <Label htmlFor="signup-limit" className="text-base font-medium">
                  Limite de cadastros por IP (24h)
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Número máximo de contas que podem ser criadas do mesmo IP em 24 horas
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  id="signup-limit"
                  type="number"
                  min={1}
                  max={100}
                  value={signupLimitPerIp}
                  onChange={(e) => setSignupLimitPerIp(parseInt(e.target.value) || 3)}
                  className="w-20 text-center"
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    setSaving(true);
                    try {
                      const { data: existing } = await supabase
                        .from("system_settings")
                        .select("key")
                        .eq("key", "signup_limit_per_ip")
                        .maybeSingle();

                      if (existing) {
                        await supabase
                          .from("system_settings")
                          .update({ 
                            value: signupLimitPerIp.toString(), 
                            updated_by: user?.id,
                            updated_at: new Date().toISOString()
                          })
                          .eq("key", "signup_limit_per_ip");
                      } else {
                        await supabase
                          .from("system_settings")
                          .insert({ 
                            key: "signup_limit_per_ip",
                            value: signupLimitPerIp.toString(),
                            description: "Limite de cadastros por IP em 24 horas",
                            updated_by: user?.id
                          });
                      }

                      toast.success(`Limite atualizado para ${signupLimitPerIp} cadastros/IP/24h`);
                    } catch (error) {
                      console.error("Erro ao salvar:", error);
                      toast.error("Erro ao salvar configuração");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-3 bg-muted/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-orange-500">{signupLimitPerIp}</p>
                <p className="text-xs text-muted-foreground">Limite atual</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-muted-foreground">24h</p>
                <p className="text-xs text-muted-foreground">Janela de tempo</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-500">✓</p>
                <p className="text-xs text-muted-foreground">Proteção ativa</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              💡 Recomendação: 3-5 cadastros por IP é um bom equilíbrio entre segurança e usabilidade (ex: redes corporativas).
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminSettings;
