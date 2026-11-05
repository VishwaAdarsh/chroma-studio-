// Chroma Studio - Supabase Edge Function: Create Subscription Order
// Securely creates a Razorpay order for monthly or yearly Pro plan using server-side secrets.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const PLANS = {
  pro_monthly: {
    id: 'pro_monthly',
    name: 'Chroma Studio Pro (Monthly)',
    amount: 9900, // in paise (₹99.00)
    currency: 'INR',
    interval: 'month',
    displayPrice: '₹99/month',
  },
  pro_yearly: {
    id: 'pro_yearly',
    name: 'Chroma Studio Pro (Yearly)',
    amount: 59900, // in paise (₹599.00)
    currency: 'INR',
    interval: 'year',
    displayPrice: '₹599/year',
  },
} as const;

type PlanKey = keyof typeof PLANS;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing Authorization header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired session token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { planId } = body;

    if (!planId || !(planId in PLANS)) {
      return new Response(
        JSON.stringify({ error: `Invalid plan specified. Allowed plans: ${Object.keys(PLANS).join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const selectedPlan = PLANS[planId as PlanKey];
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    // 1. Live / Sandbox Razorpay API Integration
    if (razorpayKeyId && razorpayKeySecret) {
      const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
      const receiptId = `rcpt_${user.id.substring(0, 8)}_${Date.now()}`;

      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: selectedPlan.amount,
          currency: selectedPlan.currency,
          receipt: receiptId,
          notes: {
            user_id: user.id,
            user_email: user.email || '',
            plan_id: selectedPlan.id,
            billing_interval: selectedPlan.interval,
          },
        }),
      });

      if (!rzpRes.ok) {
        const errJson = await rzpRes.json();
        console.error('[create-subscription] Razorpay Orders API Error:', errJson);
        return new Response(
          JSON.stringify({ error: errJson.error?.description || 'Failed to initialize Razorpay payment order.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const orderData = await rzpRes.json();

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'live',
          orderId: orderData.id,
          amount: orderData.amount,
          currency: orderData.currency,
          keyId: razorpayKeyId,
          plan: selectedPlan,
          customer: {
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.full_name || '',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verified Test Mode Fallback (When Razorpay secrets are pending configuration)
    console.warn('[create-subscription] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set in Supabase Secrets. Providing test sandbox order.');
    const testOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'test',
        orderId: testOrderId,
        amount: selectedPlan.amount,
        currency: selectedPlan.currency,
        keyId: 'rzp_test_ChromaStudioSandboxKey',
        plan: selectedPlan,
        customer: {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || '',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[create-subscription] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error while creating subscription order.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
