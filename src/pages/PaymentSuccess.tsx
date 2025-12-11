import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ArrowRight, Loader2, Github } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(true);
  const [subscriptionVerified, setSubscriptionVerified] = useState(false);

  useEffect(() => {
    const verifySubscription = async () => {
      const sessionId = searchParams.get("session_id");
      
      if (!sessionId) {
        setIsVerifying(false);
        return;
      }

      try {
        // Call check-subscription to sync the subscription status
        const { data, error } = await supabase.functions.invoke("check-subscription");
        
        if (error) {
          console.error("Error verifying subscription:", error);
          toast.error("Erro ao verificar assinatura, mas o pagamento foi processado.");
        } else if (data?.subscribed) {
          setSubscriptionVerified(true);
          toast.success("Assinatura ativada com sucesso!");
        }
      } catch (err) {
        console.error("Verification error:", err);
      } finally {
        setIsVerifying(false);
      }
    };

    verifySubscription();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
            {isVerifying ? (
              <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
            ) : (
              <CheckCircle className="w-8 h-8 text-green-500" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isVerifying ? "Verificando pagamento..." : "Pagamento Confirmado!"}
          </CardTitle>
          <CardDescription className="text-base">
            {isVerifying 
              ? "Aguarde enquanto confirmamos sua assinatura" 
              : "Sua assinatura foi ativada com sucesso. Aproveite todos os recursos premium!"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isVerifying && (
            <>
              <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                <p>Um e-mail de confirmação foi enviado para você.</p>
                <p className="mt-1">Você pode gerenciar sua assinatura a qualquer momento pelo Dashboard.</p>
              </div>
              
              <div className="flex flex-col gap-3">
                <Button 
                  className="w-full" 
                  onClick={() => navigate("/dashboard")}
                >
                  Ir para o Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate("/")}
                >
                  <Github className="w-4 h-4 mr-2" />
                  Analisar um Projeto
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
