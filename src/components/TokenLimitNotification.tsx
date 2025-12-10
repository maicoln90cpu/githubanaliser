import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Zap, AlertTriangle } from "lucide-react";

interface TokenLimitNotificationProps {
  tokensUsedPercent: number;
  tokensRemaining: number | null;
  maxTokensMonthly: number | null;
  planName: string;
}

export function TokenLimitNotification({
  tokensUsedPercent,
  tokensRemaining,
  maxTokensMonthly,
  planName,
}: TokenLimitNotificationProps) {
  const hasShown80 = useRef(false);
  const hasShown100 = useRef(false);

  useEffect(() => {
    // Don't show for unlimited plans
    if (maxTokensMonthly === null) return;

    // Show 80% warning once per session
    if (tokensUsedPercent >= 80 && tokensUsedPercent < 100 && !hasShown80.current) {
      hasShown80.current = true;
      toast.warning(
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-yellow-500 mt-0.5" />
          <div>
            <p className="font-medium">80% dos tokens consumidos</p>
            <p className="text-sm text-muted-foreground">
              Restam {tokensRemaining !== null ? `${(tokensRemaining / 1000).toFixed(1)}K` : '—'} tokens este mês.
              Considere usar análises de profundidade menor.
            </p>
          </div>
        </div>,
        {
          duration: 8000,
          id: 'token-limit-80',
        }
      );
    }

    // Show 100% limit reached once per session
    if (tokensUsedPercent >= 100 && !hasShown100.current) {
      hasShown100.current = true;
      toast.error(
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
          <div>
            <p className="font-medium">Limite de tokens atingido</p>
            <p className="text-sm text-muted-foreground">
              Seu plano {planName} atingiu o limite mensal.
              Faça upgrade para continuar analisando.
            </p>
          </div>
        </div>,
        {
          duration: 10000,
          id: 'token-limit-100',
        }
      );
    }
  }, [tokensUsedPercent, tokensRemaining, maxTokensMonthly, planName]);

  // This component doesn't render anything - it just shows toasts
  return null;
}
