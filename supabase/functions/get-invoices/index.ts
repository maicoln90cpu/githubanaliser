import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-INVOICES] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found");
      return new Response(JSON.stringify({ invoices: [], subscription: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    // Get invoices
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 20,
    });

    // Get active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
    });

    const activeSubscription = subscriptions.data[0];
    let subscriptionDetails = null;

    if (activeSubscription) {
      const product = await stripe.products.retrieve(
        activeSubscription.items.data[0].price.product as string
      );
      
      subscriptionDetails = {
        id: activeSubscription.id,
        status: activeSubscription.status,
        currentPeriodStart: new Date(activeSubscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(activeSubscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
        canceledAt: activeSubscription.canceled_at 
          ? new Date(activeSubscription.canceled_at * 1000).toISOString() 
          : null,
        productName: product.name,
        priceAmount: activeSubscription.items.data[0].price.unit_amount,
        priceCurrency: activeSubscription.items.data[0].price.currency,
        priceInterval: activeSubscription.items.data[0].price.recurring?.interval,
      };
    }

    const formattedInvoices = invoices.data.map((invoice: Stripe.Invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      created: new Date(invoice.created * 1000).toISOString(),
      paidAt: invoice.status_transitions?.paid_at 
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() 
        : null,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      description: invoice.lines.data[0]?.description || "Assinatura",
    }));

    logStep("Invoices retrieved", { count: formattedInvoices.length });

    return new Response(JSON.stringify({ 
      invoices: formattedInvoices, 
      subscription: subscriptionDetails 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
