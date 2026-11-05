// Chroma Studio - Subscription & Razorpay Client Service
// Manages Razorpay script injection, order creation, payment verification, and entitlement evaluation.

import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type {
  EntitlementFeature,
  PaymentVerificationRequest,
  PaymentVerificationResponse,
  RazorpayOrderResponse,
  SubscriptionPlan,
  SubscriptionStatus,
} from './types';

const SUB_CACHE_KEY = 'chroma_studio_subscription_cache';

export interface CachedSubscription {
  isPro: boolean;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cachedAt: number;
}

export class SubscriptionService {
  private static scriptLoadingPromise: Promise<boolean> | null = null;

  /**
   * Loads the Razorpay checkout script dynamically
   */
  static loadRazorpayScript(): Promise<boolean> {
    if (typeof window === 'undefined') return Promise.resolve(false);
    if ((window as any).Razorpay) return Promise.resolve(true);

    if (this.scriptLoadingPromise) return this.scriptLoadingPromise;

    this.scriptLoadingPromise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.error('[SubscriptionService] Failed to load Razorpay checkout script.');
        resolve(false);
      };
      document.body.appendChild(script);
    });

    return this.scriptLoadingPromise;
  }

  /**
   * Creates a Razorpay order via Supabase Edge Function
   */
  static async createOrder(planId: 'pro_monthly' | 'pro_yearly'): Promise<{
    data: RazorpayOrderResponse | null;
    error: Error | null;
  }> {
    if (!isSupabaseConfigured || !supabase) {
      // Local fallback test order
      return {
        data: {
          success: true,
          mode: 'test',
          orderId: `order_test_${Date.now()}`,
          amount: planId === 'pro_yearly' ? 59900 : 9900,
          currency: 'INR',
          keyId: 'rzp_test_ChromaStudioSandboxKey',
          plan: {
            id: planId,
            name: planId === 'pro_yearly' ? 'Chroma Studio Pro (Yearly)' : 'Chroma Studio Pro (Monthly)',
            amount: planId === 'pro_yearly' ? 59900 : 9900,
            currency: 'INR',
            interval: planId === 'pro_yearly' ? 'year' : 'month',
          },
          customer: {
            id: 'mock-user-id',
            email: 'creator@chromastudio.app',
            name: 'Creator',
          },
        },
        error: null,
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: { planId },
      });

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to create subscription order') };
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  /**
   * Verifies the payment signature via server-side Edge Function
   */
  static async verifyPayment(
    params: PaymentVerificationRequest
  ): Promise<{ data: PaymentVerificationResponse | null; error: Error | null }> {
    if (!isSupabaseConfigured || !supabase) {
      // Mock verification for local test mode
      const now = new Date();
      const periodDays = params.planId === 'pro_yearly' ? 365 : 30;
      const end = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);
      const res: PaymentVerificationResponse = {
        success: true,
        entitlement: 'pro',
        plan: params.planId,
        status: 'active',
        current_period_end: end.toISOString(),
      };
      this.cacheSubscription({
        isPro: true,
        plan: params.planId,
        status: 'active',
        currentPeriodEnd: end.toISOString(),
        cachedAt: Date.now(),
      });
      return { data: res, error: null };
    }

    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: params,
      });

      if (error || !data?.success) {
        return {
          data: null,
          error: new Error(data?.error || error?.message || 'Payment signature verification failed.'),
        };
      }

      this.cacheSubscription({
        isPro: true,
        plan: data.plan,
        status: data.status,
        currentPeriodEnd: data.current_period_end,
        cachedAt: Date.now(),
      });

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  /**
   * Fetches the user's active subscription status from the backend
   */
  static async getSubscriptionStatus(): Promise<{
    isPro: boolean;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
  }> {
    if (!isSupabaseConfigured || !supabase) {
      const cached = this.getCachedSubscription();
      return {
        isPro: cached?.isPro || false,
        plan: cached?.plan || 'free',
        status: cached?.status || 'none',
        currentPeriodEnd: cached?.currentPeriodEnd || null,
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('get-subscription');
      if (!error && data) {
        const isPro = Boolean(data.isPro);
        this.cacheSubscription({
          isPro,
          plan: data.plan,
          status: data.status,
          currentPeriodEnd: data.currentPeriodEnd,
          cachedAt: Date.now(),
        });
        return {
          isPro,
          plan: data.plan,
          status: data.status,
          currentPeriodEnd: data.currentPeriodEnd,
        };
      }
    } catch (err) {
      console.warn('[SubscriptionService] Remote status fetch note:', err);
    }

    // Direct database RLS query fallback
    try {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .maybeSingle();

      if (sub) {
        const isValid = sub.current_period_end ? new Date(sub.current_period_end) > new Date() : false;
        const isPro = sub.status === 'active' && isValid;
        return {
          isPro,
          plan: isPro ? sub.plan : 'free',
          status: sub.status,
          currentPeriodEnd: sub.current_period_end,
        };
      }
    } catch {
      // ignore
    }

    return {
      isPro: false,
      plan: 'free',
      status: 'none',
      currentPeriodEnd: null,
    };
  }

  /**
   * Evaluates if a given feature requires Pro access
   */
  static requiresPro(feature: EntitlementFeature): boolean {
    const PRO_FEATURES: Set<EntitlementFeature> = new Set([
      'ai_assistant_unlimited',
      'ai_enhancement_pro',
      'ai_inpaint_unlimited',
      'ai_cutout_pro',
      'ai_background_gen',
      'ai_image_gen',
      'smart_presets_multimodal',
      'cloud_storage_10gb',
      'export_4k_lossless',
      'pro_templates',
    ]);
    return PRO_FEATURES.has(feature);
  }

  /**
   * Cache management for instant startup rendering
   */
  static cacheSubscription(sub: Omit<CachedSubscription, 'cachedAt'> & { cachedAt?: number }): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const entry: CachedSubscription = {
        ...sub,
        cachedAt: sub.cachedAt || Date.now(),
      };
      localStorage.setItem(SUB_CACHE_KEY, JSON.stringify(entry));
    } catch {
      // ignore
    }
  }

  static setCachedSubscription(sub: Omit<CachedSubscription, 'cachedAt'> & { cachedAt?: number }): void {
    this.cacheSubscription(sub);
  }

  static getCachedSubscription(): CachedSubscription | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(SUB_CACHE_KEY);
      if (!raw) return null;
      const data: CachedSubscription = JSON.parse(raw);
      // Invalidate if older than 5 minutes (TTL: 300,000 ms)
      if (data.cachedAt && Date.now() - data.cachedAt > 5 * 60 * 1000) {
        this.clearCache();
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  static clearCache(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(SUB_CACHE_KEY);
    } catch {
      // ignore
    }
  }
}
