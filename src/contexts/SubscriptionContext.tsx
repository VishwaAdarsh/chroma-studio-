import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { SubscriptionService } from '../services/subscription/subscriptionService';
import { storageMonitorService } from '../services/storageMonitorService';
import type {
  EntitlementFeature,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../services/subscription/types';

interface SubscriptionContextType {
  isPro: boolean;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  loading: boolean;
  upgradeModalOpen: boolean;
  upgradeReason: string | null;
  openUpgradeModal: (reason?: string) => void;
  closeUpgradeModal: () => void;
  checkFeatureAccess: (
    feature: EntitlementFeature,
    onAllowed?: () => void,
    promptReason?: string
  ) => boolean;
  refreshSubscription: () => Promise<void>;
  initiateCheckout: (planId: 'pro_monthly' | 'pro_yearly') => Promise<{ success: boolean; error?: string }>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();

  const [isPro, setIsPro] = useState<boolean>(() => {
    const cached = SubscriptionService.getCachedSubscription();
    return cached?.isPro || profile?.role === 'pro' || false;
  });

  const [plan, setPlan] = useState<SubscriptionPlan>(() => {
    const cached = SubscriptionService.getCachedSubscription();
    return cached?.plan || (profile?.role === 'pro' ? 'pro_monthly' : 'free');
  });

  const [status, setStatus] = useState<SubscriptionStatus>(() => {
    const cached = SubscriptionService.getCachedSubscription();
    return cached?.status || (profile?.role === 'pro' ? 'active' : 'none');
  });

  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(() => {
    const cached = SubscriptionService.getCachedSubscription();
    return cached?.currentPeriodEnd || null;
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState<boolean>(false);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);

  // Sync state when user logs in, out, or profile role changes
  const refreshSubscription = useCallback(async () => {
    if (!user) {
      setIsPro(false);
      setPlan('free');
      setStatus('none');
      setCurrentPeriodEnd(null);
      SubscriptionService.clearCache();
      return;
    }

    setLoading(true);
    try {
      const res = await SubscriptionService.getSubscriptionStatus();
      setIsPro(res.isPro || profile?.role === 'pro');
      setPlan(res.plan);
      setStatus(res.status);
      setCurrentPeriodEnd(res.currentPeriodEnd);
      storageMonitorService.notifyChange().catch(() => {});
    } catch (err) {
      console.warn('[SubscriptionContext] Refresh subscription note:', err);
    } finally {
      setLoading(false);
    }
  }, [user, profile?.role]);

  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  const openUpgradeModal = useCallback((reason?: string) => {
    setUpgradeReason(reason || null);
    setUpgradeModalOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModalOpen(false);
    setUpgradeReason(null);
  }, []);

  /**
   * Centralized Feature Gating Check
   * If user has Pro, executes onAllowed and returns true.
   * If free, opens UpgradeModal with explanation and returns false.
   */
  const checkFeatureAccess = useCallback(
    (feature: EntitlementFeature, onAllowed?: () => void, promptReason?: string): boolean => {
      const needsPro = SubscriptionService.requiresPro(feature);
      if (!needsPro || isPro) {
        if (onAllowed) onAllowed();
        return true;
      }

      const defaultReasons: Record<EntitlementFeature, string> = {
        ai_assistant_unlimited: 'Upgrade to Chroma Pro for unlimited AI photo editing suggestions.',
        ai_enhancement_pro: 'Upgrade to Chroma Pro for multi-zone Cloud AI photo enhancement.',
        ai_inpaint_unlimited: 'Upgrade to Chroma Pro for generative object removal and inpainting.',
        ai_cutout_pro: 'Upgrade to Chroma Pro for ultra-precise AI edge cutout.',
        ai_background_gen: 'Upgrade to Chroma Pro to synthesize custom AI backdrops.',
        ai_image_gen: 'Upgrade to Chroma Pro to generate images from natural text prompts.',
        smart_presets_multimodal: 'Upgrade to Chroma Pro for multimodal AI preset vision recommendations.',
        cloud_storage_10gb: 'Upgrade to Chroma Pro for 10 GB cloud storage and unlimited projects.',
        export_4k_lossless: 'Upgrade to Chroma Pro for uncompressed 4K exports.',
        pro_templates: 'Upgrade to Chroma Pro to unlock all 100+ creative templates.',
      };

      openUpgradeModal(promptReason || defaultReasons[feature] || 'Upgrade to Chroma Pro to unlock this feature.');
      return false;
    },
    [isPro, openUpgradeModal]
  );

  /**
   * Initiates Razorpay Checkout
   */
  const initiateCheckout = useCallback(
    async (planId: 'pro_monthly' | 'pro_yearly'): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Please sign in to subscribe to Chroma Pro.' };
      }

      setLoading(true);

      try {
        // 1. Create order from backend
        const { data: orderData, error: orderErr } = await SubscriptionService.createOrder(planId);
        if (orderErr || !orderData) {
          setLoading(false);
          return { success: false, error: orderErr?.message || 'Failed to create payment order.' };
        }

        // 2. Load Razorpay Checkout Script
        const scriptLoaded = await SubscriptionService.loadRazorpayScript();
        if (!scriptLoaded) {
          // If in test sandbox mode without external CDN
          if (orderData.mode === 'test') {
            console.warn('[SubscriptionContext] Running simulated verification in sandbox mode.');
            const { data: verifyData, error: verifyErr } = await SubscriptionService.verifyPayment({
              razorpay_order_id: orderData.orderId,
              razorpay_payment_id: `pay_test_${Date.now()}`,
              razorpay_signature: 'test_signature_valid',
              planId,
            });

            setLoading(false);
            if (verifyErr || !verifyData?.success) {
              return { success: false, error: verifyErr?.message || 'Verification failed.' };
            }

            setIsPro(true);
            setPlan(planId);
            setStatus('active');
            setCurrentPeriodEnd(verifyData.current_period_end);
            return { success: true };
          }

          setLoading(false);
          return {
            success: false,
            error: 'Razorpay Checkout could not be loaded. Please verify your internet connection.',
          };
        }

        // 3. Open Razorpay Checkout Dialog
        return new Promise((resolve) => {
          const options = {
            key: orderData.keyId,
            amount: orderData.amount,
            currency: orderData.currency,
            name: 'Chroma Studio',
            description: orderData.plan.name,
            image: '/assets/icon.png',
            order_id: orderData.orderId,
            prefill: {
              name: orderData.customer.name,
              email: orderData.customer.email,
            },
            theme: {
              color: '#8B5CF6',
              backdrop_color: 'rgba(7, 11, 20, 0.85)',
            },
            handler: async (response: any) => {
              // 4. Server-Side Payment Verification
              try {
                const { data: verifyData, error: verifyErr } = await SubscriptionService.verifyPayment({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  planId,
                });

                setLoading(false);

                if (verifyErr || !verifyData?.success) {
                  resolve({
                    success: false,
                    error: verifyErr?.message || 'Payment signature verification failed.',
                  });
                  return;
                }

                setIsPro(true);
                setPlan(planId);
                setStatus('active');
                setCurrentPeriodEnd(verifyData.current_period_end);
                resolve({ success: true });
              } catch (err: any) {
                setLoading(false);
                resolve({ success: false, error: err.message || 'Payment verification encountered an error.' });
              }
            },
            modal: {
              ondismiss: () => {
                setLoading(false);
                resolve({ success: false, error: 'Payment was cancelled by user.' });
              },
            },
          };

          const rzp = new (window as any).Razorpay(options);
          rzp.on('payment.failed', (failResp: any) => {
            setLoading(false);
            console.error('[SubscriptionContext] Razorpay Payment Failed:', failResp.error);
            resolve({
              success: false,
              error: failResp.error?.description || 'Payment was declined or failed.',
            });
          });
          rzp.open();
        });
      } catch (err: any) {
        setLoading(false);
        return { success: false, error: err.message || 'Checkout failed.' };
      }
    },
    [user]
  );

  return (
    <SubscriptionContext.Provider
      value={{
        isPro,
        plan,
        status,
        currentPeriodEnd,
        loading,
        upgradeModalOpen,
        upgradeReason,
        openUpgradeModal,
        closeUpgradeModal,
        checkFeatureAccess,
        refreshSubscription,
        initiateCheckout,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
