import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!signature) {
      logStep("ERROR", { message: "No stripe-signature header" });
      return new Response(JSON.stringify({ error: "No signature" }), { status: 400 });
    }

    const body = await req.text();
    let event: Stripe.Event;

    if (webhookSecret) {
      try {
        // Use constructEventAsync for Deno environments
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logStep("ERROR", { message: `Webhook signature verification failed: ${errorMessage}` });
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
      }
    } else {
      // For testing without webhook secret
      event = JSON.parse(body);
      logStep("WARNING", { message: "No webhook secret configured, skipping signature verification" });
    }

    logStep("Event received", { type: event.type, id: event.id });

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
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

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  logStep("Handling subscription change", { 
    subscriptionId: subscription.id, 
    status: subscription.status,
    customerId: subscription.customer 
  });

  const customerId = typeof subscription.customer === 'string' 
    ? subscription.customer 
    : subscription.customer.id;

  // Get customer email to find user
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) {
    logStep("Customer deleted", { customerId });
    return;
  }

  const email = customer.email;
  if (!email) {
    logStep("No email for customer", { customerId });
    return;
  }

  // Find user by email
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (!profile) {
    logStep("No profile found for email", { email });
    return;
  }

  // Get plan from price
  const priceId = subscription.items.data[0]?.price.id;
  const { data: plan } = await supabaseClient
    .from("plans")
    .select("id")
    .eq("stripe_price_id", priceId)
    .single();

  const status = subscription.status === 'active' || subscription.status === 'trialing' 
    ? 'active' 
    : subscription.status;

  // Safe date conversion helper
  const startDate = subscription.start_date 
    ? new Date(subscription.start_date * 1000).toISOString()
    : new Date().toISOString();
  
  const expiresAt = subscription.current_period_end 
    ? new Date(subscription.current_period_end * 1000).toISOString() 
    : null;

  // Upsert subscription
  const { error } = await supabaseClient
    .from("user_subscriptions")
    .upsert({
      user_id: profile.id,
      plan_id: plan?.id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      status: status,
      started_at: startDate,
      expires_at: expiresAt,
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    logStep("Error upserting subscription", { error: error.message });
  } else {
    logStep("Subscription updated successfully", { userId: profile.id, status });
  }
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  logStep("Handling subscription canceled", { subscriptionId: subscription.id });

  const { error } = await supabaseClient
    .from("user_subscriptions")
    .update({ status: 'canceled' })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    logStep("Error canceling subscription", { error: error.message });
  } else {
    logStep("Subscription canceled successfully");
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  logStep("Payment succeeded", { 
    invoiceId: invoice.id, 
    amount: invoice.amount_paid,
    customerId: invoice.customer 
  });
  
  // If subscription payment, ensure subscription is active
  if (invoice.subscription) {
    const subscriptionId = typeof invoice.subscription === 'string' 
      ? invoice.subscription 
      : invoice.subscription.id;

    await supabaseClient
      .from("user_subscriptions")
      .update({ status: 'active' })
      .eq("stripe_subscription_id", subscriptionId);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  logStep("Payment failed", { 
    invoiceId: invoice.id, 
    customerId: invoice.customer 
  });

  if (invoice.subscription) {
    const subscriptionId = typeof invoice.subscription === 'string' 
      ? invoice.subscription 
      : invoice.subscription.id;

    await supabaseClient
      .from("user_subscriptions")
      .update({ status: 'past_due' })
      .eq("stripe_subscription_id", subscriptionId);
  }
}
