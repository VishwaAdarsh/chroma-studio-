// Chroma Studio - Supabase Edge Function: Get Subscription Status
// Returns server-validated subscription status and entitlement flags for the caller.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ isPro: false, plan: 'free', status: 'none' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ isPro: false, plan: 'free', status: 'none' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Query user's subscription record (protected by RLS)
    const { data: sub, error: subError } = await userClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (subError) {
      console.warn('[get-subscription] Subscription query note:', subError);
    }

    const now = new Date();
    const isPeriodValid = sub?.current_period_end ? new Date(sub.current_period_end) > now : false;
    const isPro = Boolean(sub && sub.status === 'active' && isPeriodValid);

    // If subscription has expired, update database asynchronously with service role
    if (sub && sub.status === 'active' && !isPeriodValid) {
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || supabaseAnonKey;
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      await adminClient.from('subscriptions').update({ status: 'expired' }).eq('id', sub.id);
      await adminClient.from('profiles').update({ role: 'user' }).eq('id', user.id);
    }

    return new Response(
      JSON.stringify({
        isPro,
        plan: isPro ? sub?.plan : 'free',
        status: isPro ? sub?.status : sub?.status || 'none',
        billingInterval: sub?.billing_interval || 'none',
        currentPeriodStart: sub?.current_period_start || null,
        currentPeriodEnd: sub?.current_period_end || null,
        cancelAtPeriodEnd: sub?.cancel_at_period_end || false,
        amountInr: sub?.amount_inr || 0,
        subscription: sub || null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[get-subscription] Error:', err);
    return new Response(
      JSON.stringify({ isPro: false, plan: 'free', status: 'error', error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
