// Chroma Studio - Supabase Edge Function: Razorpay Webhook Handler
// Handles asynchronous webhook notifications with cryptographic signature verification and idempotency.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function computeHmacSha256(rawBody: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const hashArray = Array.from(new Uint8Array(sigBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || req.headers.get('X-Razorpay-Signature');
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');

    // 1. Webhook Signature Verification
    if (webhookSecret) {
      if (!signature) {
        return new Response(JSON.stringify({ error: 'Missing x-razorpay-signature header' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const expectedSignature = await computeHmacSha256(rawBody, webhookSecret);
      if (expectedSignature.toLowerCase() !== signature.toLowerCase()) {
        console.error('[razorpay-webhook] Invalid signature. Received:', signature, 'Expected:', expectedSignature);
        return new Response(JSON.stringify({ error: 'Invalid webhook signature.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.warn('[razorpay-webhook] Warning: RAZORPAY_WEBHOOK_SECRET not configured. Running in sandbox bypass mode.');
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const eventId = event.event_id || event.id || `evt_${Date.now()}`;
    const payload = event.payload || {};

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Idempotency Check: Don't process the same event twice
    const { data: existingEvent } = await adminClient
      .from('payment_events')
      .select('id')
      .eq('provider_event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      console.log(`[razorpay-webhook] Event ${eventId} was already processed. Acknowledging with 200 OK.`);
      return new Response(JSON.stringify({ status: 'already_processed', eventId }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paymentEntity = payload.payment?.entity || {};
    const orderEntity = payload.order?.entity || {};
    const subscriptionEntity = payload.subscription?.entity || {};

    const orderId = paymentEntity.order_id || orderEntity.id || subscriptionEntity.id;
    const paymentId = paymentEntity.id;
    const notes = paymentEntity.notes || orderEntity.notes || subscriptionEntity.notes || {};
    const userId = notes.user_id;
    const planId = notes.plan_id || 'pro_monthly';

    const now = new Date();

    // 3. Handle specific lifecycle events
    if (eventType === 'payment.captured' || eventType === 'order.paid' || eventType === 'subscription.charged') {
      if (userId) {
        const isYearly = planId === 'pro_yearly';
        const amountInr = isYearly ? 599.0 : 99.0;
        const durationDays = isYearly ? 365 : 30;
        const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

        await adminClient.from('subscriptions').upsert(
          {
            user_id: userId,
            plan: isYearly ? 'pro_yearly' : 'pro_monthly',
            status: 'active',
            billing_interval: isYearly ? 'year' : 'month',
            amount_inr: amountInr,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            cancel_at_period_end: false,
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            updated_at: now.toISOString(),
          },
          { onConflict: 'user_id' }
        );

        await adminClient
          .from('profiles')
          .update({ role: 'pro', updated_at: now.toISOString() })
          .eq('id', userId);
      }
    } else if (eventType === 'payment.failed') {
      if (userId) {
        console.warn(`[razorpay-webhook] Payment failed for user ${userId}, payment: ${paymentId}`);
      }
    } else if (eventType === 'subscription.cancelled' || eventType === 'subscription.halted') {
      if (userId) {
        await adminClient
          .from('subscriptions')
          .update({
            status: 'cancelled',
            cancelled_at: now.toISOString(),
            cancel_at_period_end: true,
            updated_at: now.toISOString(),
          })
          .eq('user_id', userId);
      }
    } else if (eventType === 'refund.processed') {
      if (userId) {
        await adminClient
          .from('subscriptions')
          .update({
            status: 'expired',
            updated_at: now.toISOString(),
          })
          .eq('user_id', userId);

        await adminClient
          .from('profiles')
          .update({ role: 'user', updated_at: now.toISOString() })
          .eq('id', userId);
      }
    }

    // 4. Record event in payment_events for audit log
    await adminClient.from('payment_events').insert({
      user_id: userId || null,
      event_type: eventType,
      provider: 'razorpay',
      provider_event_id: eventId,
      razorpay_order_id: orderId || null,
      razorpay_payment_id: paymentId || null,
      amount_inr: paymentEntity.amount ? paymentEntity.amount / 100 : null,
      currency: paymentEntity.currency || 'INR',
      status: 'processed',
      payload: event,
      processed_at: now.toISOString(),
    });

    return new Response(JSON.stringify({ success: true, processed: eventType }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[razorpay-webhook] Webhook execution error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Webhook processing failed.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
