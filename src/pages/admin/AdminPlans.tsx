import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Github, 
  Home, 
  Loader2, 
  Crown,
  Check,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/useAdmin";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthly_analyses: number;
  daily_analyses: number;
  price_monthly: number;
  features: string[];
  is_active: boolean;
}

const AdminPlans = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (adminLoading) return;

    if (!isAdmin) {
      toast.error("Acesso negado. Área restrita para administradores.");
      navigate("/dashboard");
      return;
    }

    const loadPlans = async () => {
      try {
        const { data, error } = await supabase
          .from("plans")
          .select("*")
          .order("price_monthly", { ascending: true });

        if (error) throw error;
        
        setPlans(data.map(p => ({
          ...p,
          features: Array.isArray(p.features) ? (p.features as string[]) : []
        })));
      } catch (error) {
        console.error("Erro ao carregar planos:", error);
        toast.error("Erro ao carregar planos");
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, [isAdmin, adminLoading, navigate]);

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
            <Crown className="w-8 h-8 text-yellow-500" />
            <h1 className="text-3xl font-bold">Planos de Assinatura</h1>
          </div>
          <p className="text-muted-foreground">
            Gerencie os planos disponíveis para os usuários
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6 animate-slide-up">
          {plans.map((plan, index) => (
            <div 
              key={plan.id}
              className={`p-6 bg-card border rounded-xl relative ${
                plan.slug === 'pro' 
                  ? 'border-primary shadow-lg' 
                  : 'border-border'
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {plan.slug === 'pro' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  Mais Popular
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold">
                    {plan.price_monthly === 0 ? 'Grátis' : `R$${plan.price_monthly.toFixed(2)}`}
                  </span>
                  {plan.price_monthly > 0 && (
                    <span className="text-muted-foreground">/mês</span>
                  )}
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Projetos/mês</span>
                    <span className="font-medium">{plan.monthly_analyses}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span>Projetos/dia</span>
                    <span className="font-medium">{plan.daily_analyses}</span>
                  </div>
                </div>

                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                  {plan.is_active ? '✅ Plano ativo' : '❌ Plano inativo'}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue Projection */}
        <div className="mt-8 p-6 bg-card border border-border rounded-xl animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <h3 className="font-semibold text-lg mb-4">Projeção de Receita</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-4 bg-muted/30 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">100 usuários Basic</p>
              <p className="text-2xl font-bold text-green-500">R$2.990</p>
              <p className="text-xs text-muted-foreground">/mês</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">50 Basic + 50 Pro</p>
              <p className="text-2xl font-bold text-green-500">R$5.490</p>
              <p className="text-xs text-muted-foreground">/mês</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">100 usuários Pro</p>
              <p className="text-2xl font-bold text-green-500">R$7.990</p>
              <p className="text-xs text-muted-foreground">/mês</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPlans;
