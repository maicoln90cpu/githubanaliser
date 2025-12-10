import { useUserPlan, estimateTokensForAnalysis, suggestDepthByTokens } from "@/hooks/useUserPlan";
import { AlertTriangle, TrendingUp, Crown, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface SpendingAlertProps {
  className?: string;
}

export function SpendingAlert({ className }: SpendingAlertProps) {
  const { plan, isLoading } = useUserPlan();
  const navigate = useNavigate();

  if (isLoading || !plan) return null;

  // If unlimited tokens, no alert needed
  if (plan.maxTokensMonthly === null) return null;

  const tokensPercent = plan.tokensUsedPercent;
  const tokensRemaining = plan.tokensRemaining || 0;

  // Determine alert level based on tokens
  const getAlertLevel = () => {
    if (tokensPercent >= 100) {
      return { level: 'critical', color: 'bg-destructive/10 border-destructive/20', iconColor: 'text-destructive' };
    }
    if (tokensPercent >= 80) {
      return { level: 'warning', color: 'bg-yellow-500/10 border-yellow-500/20', iconColor: 'text-yellow-500' };
    }
    if (tokensPercent >= 60) {
      return { level: 'info', color: 'bg-blue-500/10 border-blue-500/20', iconColor: 'text-blue-500' };
    }
    return null;
  };

  const alert = getAlertLevel();
  if (!alert) return null;

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
    return tokens.toString();
  };

  const getMessage = () => {
    if (tokensPercent >= 100) {
      return {
        title: 'Limite de tokens atingido',
        description: 'Você atingiu seu limite de tokens mensais. Faça upgrade para continuar.',
      };
    }
    if (tokensPercent >= 80) {
      const suggestedDepth = suggestDepthByTokens(tokensRemaining);
      return {
        title: `${formatTokens(tokensRemaining)} tokens restantes`,
        description: `Você usou ${tokensPercent.toFixed(0)}% do seu limite. ${
          suggestedDepth !== 'complete' 
            ? `Recomendamos usar profundidade "${suggestedDepth === 'critical' ? 'Crítica' : 'Balanceada'}".` 
            : ''
        }`,
      };
    }
    if (tokensPercent >= 60) {
      return {
        title: 'Uso moderado de tokens',
        description: `Você já usou ${tokensPercent.toFixed(0)}% do seu limite mensal (${formatTokens(tokensRemaining)} restantes).`,
      };
    }
    return {
      title: 'Monitoramento de tokens',
      description: `Uso mensal: ${tokensPercent.toFixed(0)}%`,
    };
  };

  const message = getMessage();
  const isBlocked = tokensPercent >= 100;

  return (
    <div className={`p-4 rounded-lg border ${alert.color} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${alert.color}`}>
          {isBlocked ? (
            <AlertTriangle className={`w-5 h-5 ${alert.iconColor}`} />
          ) : (
            <Zap className={`w-5 h-5 ${alert.iconColor}`} />
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

// Check if user can analyze based on token limits
export function canUserAnalyze(plan: { 
  tokensUsed: number;
  maxTokensMonthly: number | null;
  tokensRemaining: number | null;
  planName: string;
  isAdmin?: boolean;
}): { canAnalyze: boolean; reason?: string } {
  // Admins and unlimited plans can always analyze
  if (plan.isAdmin || plan.maxTokensMonthly === null) {
    return { canAnalyze: true };
  }

  if (plan.tokensUsed >= plan.maxTokensMonthly) {
    return { 
      canAnalyze: false, 
      reason: 'Limite de tokens mensais atingido. Faça upgrade do plano para continuar.' 
    };
  }

  // Check if there are enough tokens for at least a critical analysis
  const minTokensNeeded = estimateTokensForAnalysis('critical', 1);
  if (plan.tokensRemaining !== null && plan.tokensRemaining < minTokensNeeded) {
    return { 
      canAnalyze: false, 
      reason: `Tokens insuficientes. Você precisa de pelo menos ${minTokensNeeded.toLocaleString()} tokens para uma análise.` 
    };
  }

  return { canAnalyze: true };
}

// Suggest depth based on remaining tokens
export function suggestDepthBasedOnLimits(plan: {
  tokensRemaining: number | null;
  maxTokensMonthly: number | null;
}): 'critical' | 'balanced' | 'complete' {
  // Unlimited tokens
  if (plan.maxTokensMonthly === null || plan.tokensRemaining === null) {
    return 'complete';
  }

  return suggestDepthByTokens(plan.tokensRemaining, 8);
}
