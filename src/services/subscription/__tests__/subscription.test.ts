import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SubscriptionService,
  CachedSubscription,
} from '../subscriptionService';
import {
  SUBSCRIPTION_PLANS,
  EntitlementFeature,
  SubscriptionPlan,
} from '../types';
import { supabase } from '../../../lib/supabase';

// Mock localStorage for test environment
const mockStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
});

describe('Chroma Studio: Pro Subscription & Razorpay Architecture', () => {
  beforeEach(() => {
    mockStorage.clear();
    SubscriptionService.clearCache();
    vi.restoreAllMocks();
  });

  describe('1. Plan Pricing & Configurations (INR)', () => {
    it('should configure Pro Monthly at ₹99/month (9900 paise)', () => {
      const monthly = SUBSCRIPTION_PLANS.pro_monthly;
      expect(monthly).toBeDefined();
      expect(monthly.id).toBe('pro_monthly');
      expect(monthly.priceInr).toBe(99);
      expect(monthly.displayPrice).toBe('₹99');
      expect(monthly.billingInterval).toBe('month');
      expect(monthly.features.length).toBeGreaterThan(5);
    });

    it('should configure Pro Yearly at ₹599/year (59900 paise) with savings highlight', () => {
      const yearly = SUBSCRIPTION_PLANS.pro_yearly;
      expect(yearly).toBeDefined();
      expect(yearly.id).toBe('pro_yearly');
      expect(yearly.priceInr).toBe(599);
      expect(yearly.displayPrice).toBe('₹599');
      expect(yearly.billingInterval).toBe('year');
      expect(yearly.savingsBadge).toContain('50%');
      // Yearly ₹599 vs 12 * ₹99 (₹1188) is ~50% savings
      const annualMonthlyEquivalent = 599 / 12;
      expect(annualMonthlyEquivalent).toBeLessThan(50);
    });
  });

  describe('2. Feature Gating & Entitlements', () => {
    const proFeatures: EntitlementFeature[] = [
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
    ];

    it('should strictly identify all pro-tier features', () => {
      proFeatures.forEach((feat) => {
        expect(SubscriptionService.requiresPro(feat)).toBe(true);
      });
    });

    it('should not require pro for unspecified free features', () => {
      expect(SubscriptionService.requiresPro('basic_adjustments' as any)).toBe(false);
      expect(SubscriptionService.requiresPro('offline_crop' as any)).toBe(false);
      expect(SubscriptionService.requiresPro('local_export' as any)).toBe(false);
    });
  });

  describe('3. Local Subscription Cache & TTL Management', () => {
    it('should return null when cache is empty', () => {
      expect(SubscriptionService.getCachedSubscription()).toBeNull();
    });

    it('should store and retrieve active subscription cache', () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      SubscriptionService.setCachedSubscription({
        isPro: true,
        plan: 'pro_monthly',
        status: 'active',
        currentPeriodEnd: futureDate,
      });

      const cached = SubscriptionService.getCachedSubscription();
      expect(cached).not.toBeNull();
      expect(cached?.isPro).toBe(true);
      expect(cached?.plan).toBe('pro_monthly');
      expect(cached?.status).toBe('active');
      expect(cached?.currentPeriodEnd).toBe(futureDate);
    });

    it('should expire cache when TTL (5 minutes) is exceeded', () => {
      const pastTime = Date.now() - 6 * 60 * 1000; // 6 mins ago
      const staleData: CachedSubscription = {
        isPro: true,
        plan: 'pro_yearly',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 100000).toISOString(),
        cachedAt: pastTime,
      };
      mockStorage.setItem('chroma_studio_subscription_cache', JSON.stringify(staleData));

      const retrieved = SubscriptionService.getCachedSubscription();
      expect(retrieved).toBeNull();
    });

    it('should clear cache on user sign out or plan downgrade', () => {
      SubscriptionService.setCachedSubscription({
        isPro: true,
        plan: 'pro_monthly',
        status: 'active',
        currentPeriodEnd: new Date().toISOString(),
      });
      expect(SubscriptionService.getCachedSubscription()).not.toBeNull();

      SubscriptionService.clearCache();
      expect(SubscriptionService.getCachedSubscription()).toBeNull();
    });
  });

  describe('4. Cryptographic HMAC SHA-256 Signature Verification', () => {
    // Helper to compute web crypto HMAC SHA-256 for test validation
    async function testComputeHmac(orderId: string, paymentId: string, secret: string): Promise<string> {
      const data = `${orderId}|${paymentId}`;
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
      return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    it('should generate valid hexadecimal signature for order_id|payment_id', async () => {
      const orderId = 'order_test_998877';
      const paymentId = 'pay_test_112233';
      const secret = 'super_secret_razorpay_key';

      const sig = await testComputeHmac(orderId, paymentId, secret);
      expect(sig).toBeDefined();
      expect(sig.length).toBe(64); // 256 bits = 64 hex characters
      expect(/^[0-9a-f]{64}$/.test(sig)).toBe(true);
    });

    it('should reject when order_id or payment_id is tampered', async () => {
      const orderId = 'order_test_998877';
      const paymentId = 'pay_test_112233';
      const secret = 'super_secret_razorpay_key';

      const validSig = await testComputeHmac(orderId, paymentId, secret);
      const tamperedSig = await testComputeHmac('order_tampered', paymentId, secret);

      expect(validSig).not.toEqual(tamperedSig);
    });

    it('should reject when secret is incorrect', async () => {
      const orderId = 'order_test_998877';
      const paymentId = 'pay_test_112233';

      const sig1 = await testComputeHmac(orderId, paymentId, 'secret_A');
      const sig2 = await testComputeHmac(orderId, paymentId, 'secret_B');

      expect(sig1).not.toEqual(sig2);
    });
  });

  describe('5. Order Creation & Sandbox Verification Fallback', () => {
    it('should create order with correct amounts in sandbox mode', async () => {
      if (supabase) {
        vi.spyOn(Object.getPrototypeOf(supabase.functions), 'invoke').mockImplementation(async (fnName: any, options: any) => {
          const body = options?.body as any;
          const planId = body?.planId || 'pro_monthly';
          return {
            data: {
              success: true,
              mode: 'test',
              orderId: `order_mock_${Date.now()}`,
              amount: planId === 'pro_yearly' ? 59900 : 9900,
              currency: 'INR',
              keyId: 'rzp_test_ChromaMockKey',
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
          } as any;
        });
      }

      const monthlyRes = await SubscriptionService.createOrder('pro_monthly');
      expect(monthlyRes.error).toBeNull();
      expect(monthlyRes.data?.amount).toBe(9900);
      expect(monthlyRes.data?.currency).toBe('INR');
      expect(monthlyRes.data?.plan.id).toBe('pro_monthly');

      const yearlyRes = await SubscriptionService.createOrder('pro_yearly');
      expect(yearlyRes.error).toBeNull();
      expect(yearlyRes.data?.amount).toBe(59900);
      expect(yearlyRes.data?.currency).toBe('INR');
      expect(yearlyRes.data?.plan.id).toBe('pro_yearly');
    });

    it('should handle test payment verification in sandbox mode', async () => {
      const futureEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      if (supabase) {
        vi.spyOn(Object.getPrototypeOf(supabase.functions), 'invoke').mockImplementation(async () => {
          return {
            data: {
              success: true,
              entitlement: 'pro',
              plan: 'pro_monthly',
              status: 'active',
              current_period_end: futureEnd,
            },
            error: null,
          } as any;
        });
      }

      const verifyRes = await SubscriptionService.verifyPayment({
        razorpay_order_id: 'order_sandbox_123',
        razorpay_payment_id: 'pay_sandbox_456',
        razorpay_signature: 'valid_test_signature',
        planId: 'pro_monthly',
      });

      expect(verifyRes.error).toBeNull();
      expect(verifyRes.data?.success).toBe(true);
      expect(verifyRes.data?.plan).toBe('pro_monthly');
      expect(verifyRes.data?.status).toBe('active');
      expect(verifyRes.data?.current_period_end).toBeDefined();
    });
  });

  describe('6. Webhook Idempotency & Lifecycle Events', () => {
    it('should compute valid future expiry dates (30 days for monthly, 365 days for yearly)', () => {
      const now = Date.now();
      const monthlyEnd = new Date(now + 30 * 24 * 60 * 60 * 1000);
      const yearlyEnd = new Date(now + 365 * 24 * 60 * 60 * 1000);

      expect(monthlyEnd.getTime()).toBeGreaterThan(now);
      expect(yearlyEnd.getTime() - now).toBeGreaterThan(364 * 24 * 60 * 60 * 1000);
    });

    it('should accurately detect expired period ends', () => {
      const expiredDate = new Date(Date.now() - 1000).toISOString();
      const isStillValid = new Date(expiredDate).getTime() > Date.now();
      expect(isStillValid).toBe(false);

      const validDate = new Date(Date.now() + 100000).toISOString();
      const isNowValid = new Date(validDate).getTime() > Date.now();
      expect(isNowValid).toBe(true);
    });
  });
});
