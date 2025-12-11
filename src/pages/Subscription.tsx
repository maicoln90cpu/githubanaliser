import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  CreditCard, 
  Calendar, 
  Download, 
  ExternalLink, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Invoice {
  id: string;
  number: string;
  status: string;
  amount: number;
  currency: string;
  created: string;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  description: string;
}

interface SubscriptionDetails {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  productName: string;
  priceAmount: number;
  priceCurrency: string;
  priceInterval: string;
}

export default function Subscription() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchInvoices();
    }
  }, [user]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("get-invoices", {
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (response.error) throw response.error;

      setInvoices(response.data.invoices || []);
      setSubscription(response.data.subscription);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast.error("Erro ao carregar histórico de pagamentos");
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("customer-portal", {
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (response.error) throw response.error;

      if (response.data?.url) {
        window.open(response.data.url, "_blank");
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      toast.error("Erro ao abrir portal de gerenciamento");
    } finally {
      setPortalLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      active: { label: "Ativa", variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
      trialing: { label: "Período de Teste", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
      past_due: { label: "Pagamento Pendente", variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
      canceled: { label: "Cancelada", variant: "outline", icon: <XCircle className="h-3 w-3" /> },
      unpaid: { label: "Não Paga", variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" as const, icon: null };
    
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getInvoiceStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      paid: { label: "Pago", variant: "default" },
      open: { label: "Aberto", variant: "secondary" },
      draft: { label: "Rascunho", variant: "outline" },
      uncollectible: { label: "Não Cobrável", variant: "destructive" },
      void: { label: "Cancelado", variant: "outline" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" as const };
    
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Gerenciar Assinatura</h1>
            <p className="text-muted-foreground">Visualize sua assinatura e histórico de pagamentos</p>
          </div>
        </div>

        {/* Subscription Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Assinatura Atual
            </CardTitle>
            <CardDescription>Detalhes do seu plano atual</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-64" />
              </div>
            ) : subscription ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{subscription.productName}</h3>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(subscription.priceAmount, subscription.priceCurrency)}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{subscription.priceInterval === "month" ? "mês" : "ano"}
                      </span>
                    </p>
                  </div>
                  {getStatusBadge(subscription.status)}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <span className="text-muted-foreground">Período atual: </span>
                      {format(new Date(subscription.currentPeriodStart), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(subscription.currentPeriodEnd), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>

                  {subscription.cancelAtPeriodEnd && (
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">
                        Cancela em {format(new Date(subscription.currentPeriodEnd), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <Button onClick={handleManageSubscription} disabled={portalLoading}>
                    {portalLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Gerenciar no Stripe
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Nenhuma assinatura ativa</h3>
                <p className="text-muted-foreground mb-4">
                  Você está usando o plano gratuito. Faça upgrade para desbloquear mais recursos.
                </p>
                <Button onClick={() => navigate("/#pricing")}>Ver Planos</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Histórico de Pagamentos</CardTitle>
                <CardDescription>Todas as suas faturas e pagamentos</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchInvoices} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between py-4 border-b">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            ) : invoices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fatura</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{invoice.number || invoice.id.slice(-8)}</p>
                          <p className="text-xs text-muted-foreground">{invoice.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.created), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </TableCell>
                      <TableCell>{getInvoiceStatusBadge(invoice.status || "unknown")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {invoice.hostedInvoiceUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(invoice.hostedInvoiceUrl!, "_blank")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          {invoice.invoicePdf && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(invoice.invoicePdf!, "_blank")}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Nenhuma fatura encontrada</h3>
                <p className="text-muted-foreground">
                  Quando você fizer uma assinatura, suas faturas aparecerão aqui.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
