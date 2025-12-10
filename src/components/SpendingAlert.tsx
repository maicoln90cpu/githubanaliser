import { useUserPlan } from "@/hooks/useUserPlan";
import { AlertTriangle, TrendingUp, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface SpendingAlertProps {
  className?: string;
}

export function SpendingAlert({ className }: SpendingAlertProps) {
  const { plan, isLoading } = useUserPlan();
  const navigate = useNavigate();

  if (isLoading || !plan) return null;

  const dailyPercent = plan.dailyLimit > 0 && plan.dailyLimit !== 999999 
    ? (plan.dailyUsage / plan.dailyLimit) * 100 
    : 0;
  const monthlyPercent = plan.monthlyLimit > 0 && plan.monthlyLimit !== 999999 
    ? (plan.monthlyUsage / plan.monthlyLimit) * 100 
    : 0;

  // Determine alert level
  const getAlertLevel = () => {
    if (dailyPercent >= 100 || monthlyPercent >= 100) {
      return { level: 'critical', color: 'bg-destructive/10 border-destructive/20', iconColor: 'text-destructive' };
    }
    if (dailyPercent >= 80 || monthlyPercent >= 80) {
      return { level: 'warning', color: 'bg-yellow-500/10 border-yellow-500/20', iconColor: 'text-yellow-500' };
    }
    if (dailyPercent >= 60 || monthlyPercent >= 60) {
      return { level: 'info', color: 'bg-blue-500/10 border-blue-500/20', iconColor: 'text-blue-500' };
    }
    return null;
  };

  const alert = getAlertLevel();
  if (!alert) return null;

  const getMessage = () => {
    if (dailyPercent >= 100) {
      return {
        title: 'Limite diário atingido',
        description: 'Você atingiu seu limite de análises diárias. Aguarde até amanhã ou faça upgrade.',
      };
    }
    if (monthlyPercent >= 100) {
      return {
        title: 'Limite mensal atingido',
        description: 'Você atingiu seu limite de análises mensais. Faça upgrade para continuar.',
      };
    }
    if (dailyPercent >= 80) {
      return {
        title: `${plan.dailyLimit - plan.dailyUsage} análise(s) restante(s) hoje`,
        description: `Você usou ${dailyPercent.toFixed(0)}% do seu limite diário.`,
      };
    }
    if (monthlyPercent >= 80) {
      return {
        title: `${plan.monthlyLimit - plan.monthlyUsage} análise(s) restante(s) este mês`,
        description: `Você usou ${monthlyPercent.toFixed(0)}% do seu limite mensal.`,
      };
    }
    if (dailyPercent >= 60) {
      return {
        title: 'Uso moderado hoje',
        description: `Você já usou ${dailyPercent.toFixed(0)}% do seu limite diário.`,
      };
    }
    return {
      title: 'Monitoramento de uso',
      description: `Uso mensal: ${monthlyPercent.toFixed(0)}%`,
    };
  };

  const message = getMessage();
  const isBlocked = dailyPercent >= 100 || monthlyPercent >= 100;

  return (
    <div className={`p-4 rounded-lg border ${alert.color} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${alert.color}`}>
          {isBlocked ? (
            <AlertTriangle className={`w-5 h-5 ${alert.iconColor}`} />
          ) : (
            <TrendingUp className={`w-5 h-5 ${alert.iconColor}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{message.title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{message.description}</p>
        </div>
        {plan.planName === 'Free' && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate("/")}
            className="flex-shrink-0"
          >
            <Crown className="w-4 h-4 mr-1" />
            Upgrade
          </Button>
        )}
      </div>
    </div>
  );
}

export function canUserAnalyze(plan: { 
  dailyUsage: number; 
  dailyLimit: number; 
  monthlyUsage: number; 
  monthlyLimit: number;
  planName: string;
}): { canAnalyze: boolean; reason?: string } {
  // Admins and unlimited plans can always analyze
  if (plan.dailyLimit === 999999 && plan.monthlyLimit === 999999) {
    return { canAnalyze: true };
  }

  if (plan.dailyLimit !== 999999 && plan.dailyUsage >= plan.dailyLimit) {
    return { 
      canAnalyze: false, 
      reason: 'Limite diário de análises atingido. Aguarde até amanhã ou faça upgrade do plano.' 
    };
  }

  if (plan.monthlyLimit !== 999999 && plan.monthlyUsage >= plan.monthlyLimit) {
    return { 
      canAnalyze: false, 
      reason: 'Limite mensal de análises atingido. Faça upgrade do plano para continuar.' 
    };
  }

  return { canAnalyze: true };
}

export function suggestDepthBasedOnLimits(plan: {
  dailyUsage: number;
  dailyLimit: number;
  monthlyUsage: number;
  monthlyLimit: number;
}): 'critical' | 'balanced' | 'complete' {
  const dailyRemaining = plan.dailyLimit - plan.dailyUsage;
  const monthlyRemaining = plan.monthlyLimit - plan.monthlyUsage;

  // If running low on limits, suggest cheaper depth
  if (dailyRemaining <= 2 || monthlyRemaining <= 5) {
    return 'critical';
  }
  if (dailyRemaining <= 5 || monthlyRemaining <= 15) {
    return 'balanced';
  }
  return 'complete';
}