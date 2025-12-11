import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

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
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ 
        subscribed: false,
        plan_slug: 'free',
        subscription_end: null,
        stripe_customer_id: null,
        stripe_subscription_id: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let productId: string | null = null;
    let priceId: string | null = null;
    let subscriptionId: string | null = null;
    let subscriptionEnd: string | null = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionId = subscription.id;
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      productId = subscription.items.data[0].price.product as string;
      priceId = subscription.items.data[0].price.id;
      logStep("Active subscription found", { subscriptionId, productId, priceId, endDate: subscriptionEnd });

      // Lookup plan by stripe_product_id
      const { data: planData } = await supabaseClient
        .from("plans")
        .select("id, slug")
        .eq("stripe_product_id", productId)
        .maybeSingle();

      if (planData) {
        logStep("Plan found in database", { planId: planData.id, slug: planData.slug });

        // Update or create user_subscriptions record
        const startDate = subscription.start_date 
          ? new Date(subscription.start_date * 1000).toISOString() 
          : new Date().toISOString();
        
        const { error: upsertError } = await supabaseClient
          .from("user_subscriptions")
          .upsert({
            user_id: user.id,
            plan_id: planData.id,
            status: 'active',
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            expires_at: subscriptionEnd,
            started_at: startDate,
          }, {
            onConflict: 'user_id'
          });

        if (upsertError) {
          logStep("Error upserting subscription", { error: upsertError.message });
        } else {
          logStep("User subscription updated");
        }

        return new Response(JSON.stringify({
          subscribed: true,
          plan_slug: planData.slug,
          subscription_end: subscriptionEnd,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // No active subscription - ensure user has free plan
    logStep("No active subscription, setting free plan");
    
    // Get free plan
    const { data: freePlan } = await supabaseClient
      .from("plans")
      .select("id")
      .eq("slug", "free")
      .maybeSingle();

    if (freePlan) {
      // Update user subscription to free
      await supabaseClient
        .from("user_subscriptions")
        .upsert({
          user_id: user.id,
          plan_id: freePlan.id,
          status: 'active',
          stripe_subscription_id: null,
          stripe_customer_id: customerId,
          expires_at: null,
        }, {
          onConflict: 'user_id'
        });
    }

    return new Response(JSON.stringify({
      subscribed: false,
      plan_slug: 'free',
      subscription_end: null,
      stripe_customer_id: customerId,
      stripe_subscription_id: null
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
