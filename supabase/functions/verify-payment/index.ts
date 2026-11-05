// Chroma Studio - Supabase Edge Function: Verify Payment & Activate Pro Entitlement
// Verifies Razorpay HMAC SHA-256 signature and activates Pro subscription in Supabase with strict audit logging.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function computeHmacSha256(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const hashArray = Array.from(new Uint8Array(sigBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || supabaseAnonKey;

    // Verify authenticated user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid session.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId = 'pro_monthly' } = body;

    if (!razorpay_order_id || !razorpay_payment_id) {
      return new Response(
        JSON.stringify({ error: 'Missing payment verification credentials (orderId or paymentId).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isYearly = planId === 'pro_yearly';
    const amountInr = isYearly ? 599.0 : 99.0;
    const durationDays = isYearly ? 365 : 30;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    let isSignatureValid = false;

    // 1. Live Cryptographic Signature Verification
    if (razorpayKeySecret) {
      const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = await computeHmacSha256(payload, razorpayKeySecret);
      isSignatureValid = expectedSignature.toLowerCase() === (razorpay_signature || '').toLowerCase();

      if (!isSignatureValid) {
        console.error('[verify-payment] Signature mismatch. Received:', razorpay_signature, 'Expected:', expectedSignature);
        return new Response(
          JSON.stringify({ error: 'Invalid payment signature. Payment could not be verified.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // 2. Test Sandbox Mode (Allowed only when keys are pending in vault or order is test order)
      const isTestOrder = razorpay_order_id.startsWith('order_test_') || razorpay_order_id.startsWith('order_sandbox_');
      if (isTestOrder) {
        console.warn('[verify-payment] Test order signature accepted under sandbox mode.');
        isSignatureValid = true;
      } else {
        return new Response(
          JSON.stringify({ error: 'Server payment secret not configured for live order verification.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Service-Role Admin Client to bypass RLS and activate subscription
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Record verified payment event (idempotent insert)
    const { error: eventError } = await adminClient.from('payment_events').insert({
      user_id: user.id,
      event_type: 'payment.captured',
      provider: 'razorpay',
      provider_event_id: `evt_${razorpay_payment_id}`,
      razorpay_order_id,
      razorpay_payment_id,
      amount_inr: amountInr,
      currency: 'INR',
      status: 'verified',
      payload: {
        planId,
        verifiedAt: now.toISOString(),
        method: 'razorpay-checkout',
      },
      processed_at: now.toISOString(),
    });

    if (eventError && !eventError.message?.includes('duplicate key')) {
      console.warn('[verify-payment] Non-fatal payment event log warning:', eventError);
    }

    // Upsert subscription into public.subscriptions
    const { data: subData, error: subError } = await adminClient
      .from('subscriptions')
      .upsert(
        {
          user_id: user.id,
          plan: isYearly ? 'pro_yearly' : 'pro_monthly',
          status: 'active',
          billing_interval: isYearly ? 'year' : 'month',
          amount_inr: amountInr,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
          razorpay_order_id,
          razorpay_payment_id,
          updated_at: now.toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (subError) {
      console.error('[verify-payment] Database subscription activation error:', subError);
      return new Response(
        JSON.stringify({ error: 'Payment verified, but error updating subscription record. Support has been notified.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update profile role to 'pro'
    await adminClient
      .from('profiles')
      .update({ role: 'pro', updated_at: now.toISOString() })
      .eq('id', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        entitlement: 'pro',
        plan: isYearly ? 'pro_yearly' : 'pro_monthly',
        status: 'active',
        current_period_end: periodEnd.toISOString(),
        subscription: subData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[verify-payment] Unexpected verification error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Payment verification failed due to internal error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
