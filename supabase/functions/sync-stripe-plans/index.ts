import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-STRIPE-PLANS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("User not authenticated");

    // Check if user is admin
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      throw new Error("Unauthorized: Admin access required");
    }

    logStep("Admin verified", { userId: userData.user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get all active plans from database
    const { data: plans, error: plansError } = await supabaseAdmin
      .from("plans")
      .select("*")
      .eq("is_active", true);

    if (plansError) throw new Error(`Failed to fetch plans: ${plansError.message}`);
    logStep("Fetched plans from database", { count: plans?.length });

    const results: any[] = [];

    for (const plan of plans || []) {
      logStep(`Processing plan: ${plan.name}`, { slug: plan.slug, price: plan.price_monthly });

      try {
        let stripeProductId = plan.stripe_product_id;
        let stripePriceId = plan.stripe_price_id;

        // Skip free plan - no Stripe product needed
        if (plan.slug === 'free' || plan.price_monthly === 0) {
          results.push({
            plan: plan.name,
            status: 'skipped',
            reason: 'Free plan - no Stripe product needed'
          });
          continue;
        }

        // Create or update Stripe product
        if (!stripeProductId) {
          // Create new product
          const product = await stripe.products.create({
            name: plan.name,
            description: plan.description || `${plan.name} - GitHub Analyzer`,
            metadata: {
              plan_id: plan.id,
              plan_slug: plan.slug,
            }
          });
          stripeProductId = product.id;
          logStep(`Created Stripe product`, { productId: stripeProductId });
        } else {
          // Update existing product
          await stripe.products.update(stripeProductId, {
            name: plan.name,
            description: plan.description || `${plan.name} - GitHub Analyzer`,
            metadata: {
              plan_id: plan.id,
              plan_slug: plan.slug,
            }
          });
          logStep(`Updated Stripe product`, { productId: stripeProductId });
        }

        // Create or check price
        const priceInCents = Math.round((plan.price_monthly || 0) * 100);
        
        if (!stripePriceId && priceInCents > 0) {
          // Create new price
          const price = await stripe.prices.create({
            product: stripeProductId,
            unit_amount: priceInCents,
            currency: 'brl',
            recurring: { interval: 'month' },
            metadata: {
              plan_id: plan.id,
              plan_slug: plan.slug,
            }
          });
          stripePriceId = price.id;
          logStep(`Created Stripe price`, { priceId: stripePriceId, amount: priceInCents });
        } else if (stripePriceId) {
          // Check if price needs update (price amount cannot be updated, need to create new)
          const existingPrice = await stripe.prices.retrieve(stripePriceId);
          if (existingPrice.unit_amount !== priceInCents && priceInCents > 0) {
            // Archive old price and create new one
            await stripe.prices.update(stripePriceId, { active: false });
            const newPrice = await stripe.prices.create({
              product: stripeProductId,
              unit_amount: priceInCents,
              currency: 'brl',
              recurring: { interval: 'month' },
              metadata: {
                plan_id: plan.id,
                plan_slug: plan.slug,
              }
            });
            stripePriceId = newPrice.id;
            logStep(`Price updated (new price created)`, { 
              oldPrice: existingPrice.unit_amount, 
              newPrice: priceInCents,
              newPriceId: stripePriceId 
            });
          }
        }

        // Update database with Stripe IDs
        const { error: updateError } = await supabaseAdmin
          .from("plans")
          .update({
            stripe_product_id: stripeProductId,
            stripe_price_id: stripePriceId,
          })
          .eq("id", plan.id);

        if (updateError) {
          throw new Error(`Failed to update plan ${plan.name}: ${updateError.message}`);
        }

        results.push({
          plan: plan.name,
          status: 'synced',
          stripe_product_id: stripeProductId,
          stripe_price_id: stripePriceId,
          price_brl: plan.price_monthly,
        });

      } catch (planError: any) {
        logStep(`Error processing plan ${plan.name}`, { error: planError.message });
        results.push({
          plan: plan.name,
          status: 'error',
          error: planError.message,
        });
      }
    }

    logStep("Sync completed", { results });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Plans synced with Stripe",
      results 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
