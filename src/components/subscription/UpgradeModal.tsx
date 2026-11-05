import React, { useState } from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../contexts/AuthContext';
import { SUBSCRIPTION_PLANS } from '../../services/subscription/types';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string | null;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, reason }) => {
  const { isPro, plan: currentPlan, currentPeriodEnd, initiateCheckout } = useSubscription();
  const { user, openAuthModal } = useAuth();

  const [selectedPlanId, setSelectedPlanId] = useState<'pro_monthly' | 'pro_yearly'>('pro_yearly');
  const [processingState, setProcessingState] = useState<'idle' | 'opening_checkout' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubscribe = async () => {
    if (!user) {
      onClose();
      openAuthModal('signin', 'Sign in to subscribe to Chroma Studio Pro');
      return;
    }

    setErrorMessage(null);
    setProcessingState('opening_checkout');

    const result = await initiateCheckout(selectedPlanId);

    if (result.success) {
      setProcessingState('success');
      setTimeout(() => {
        setProcessingState('idle');
        onClose();
      }, 2500);
    } else {
      setProcessingState('error');
      setErrorMessage(result.error || 'Payment could not be completed.');
    }
  };

  const monthlyPlan = SUBSCRIPTION_PLANS.pro_monthly;
  const yearlyPlan = SUBSCRIPTION_PLANS.pro_yearly;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0D1424] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white max-h-[92vh]">
        {/* Header Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-gradient-to-b from-[#8B5CF6]/30 via-[#EC4899]/20 to-transparent blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-[#94A3B8] hover:text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
          title="Close"
        >
          ✕
        </button>

        <div className="p-6 sm:p-8 overflow-y-auto flex flex-col gap-6">
          {/* Header Title */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#F59E0B] via-[#EC4899] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-purple-950/40">
              <span className="material-symbols-outlined text-[30px] text-white">crown</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-[#E2E8F0] to-[#94A3B8] bg-clip-text text-transparent">
              Chroma Studio Pro
            </h2>
            <p className="text-[13px] sm:text-[14px] text-[#94A3B8] max-w-md">
              {reason || 'Unlock professional AI editing tools, generative image synthesis, and unlimited cloud projects.'}
            </p>
          </div>

          {/* If already active Pro member */}
          {isPro && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-300">
              <span className="material-symbols-outlined text-[24px]">verified</span>
              <div className="text-[13px]">
                <p className="font-bold">You are already a Pro Subscriber ({currentPlan === 'pro_yearly' ? 'Yearly' : 'Monthly'})</p>
                {currentPeriodEnd && (
                  <p className="text-[11px] text-emerald-400/80">
                    Active through: {new Date(currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Plan Selector (Monthly vs Yearly) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Monthly Card */}
            <div
              onClick={() => setSelectedPlanId('pro_monthly')}
              className={`relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                selectedPlanId === 'pro_monthly'
                  ? 'bg-[#172033] border-[#8B5CF6] ring-2 ring-[#8B5CF6]/50 shadow-xl'
                  : 'bg-[#111827]/70 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-[16px] text-white">Pro Monthly</h4>
                  <p className="text-[12px] text-[#94A3B8]">Flexible month-to-month</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    selectedPlanId === 'pro_monthly'
                      ? 'border-[#8B5CF6] bg-[#8B5CF6]'
                      : 'border-white/30'
                  }`}
                >
                  {selectedPlanId === 'pro_monthly' && <span className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>

              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-extrabold text-white">{monthlyPlan.displayPrice}</span>
                <span className="text-[12px] text-[#94A3B8]">/ month</span>
              </div>
              <p className="text-[11px] text-[#64748B]">Billed monthly. Cancel anytime.</p>
            </div>

            {/* Yearly Card (Recommended) */}
            <div
              onClick={() => setSelectedPlanId('pro_yearly')}
              className={`relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                selectedPlanId === 'pro_yearly'
                  ? 'bg-[#172033] border-[#EC4899] ring-2 ring-[#EC4899]/50 shadow-xl'
                  : 'bg-[#111827]/70 border-white/10 hover:border-white/20'
              }`}
            >
              {/* Savings Badge */}
              <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#EC4899] to-[#F59E0B] text-white font-extrabold text-[10px] uppercase tracking-wider shadow-md">
                Save 50%
              </span>

              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-[16px] text-white">Pro Yearly</h4>
                  <p className="text-[12px] text-[#94A3B8]">Best value for creators</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    selectedPlanId === 'pro_yearly'
                      ? 'border-[#EC4899] bg-[#EC4899]'
                      : 'border-white/30'
                  }`}
                >
                  {selectedPlanId === 'pro_yearly' && <span className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>

              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-3xl font-extrabold text-white">{yearlyPlan.displayPrice}</span>
                <span className="text-[12px] text-[#94A3B8]">/ year</span>
                <span className="text-[11px] text-emerald-400 font-semibold">(₹49.90/mo)</span>
              </div>
              <p className="text-[11px] text-[#64748B]">Billed annually. Includes 10 GB cloud storage.</p>
            </div>
          </div>

          {/* Feature Comparison Highlights */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-2.5 text-[12px]">
            <h5 className="font-bold text-white text-[13px] flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[18px] text-[#22D3EE]">star</span>
              Everything Unlocked with Pro:
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#CBD5E1]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">check</span>
                <span>Unlimited AI Photo Assistant Prompts</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">check</span>
                <span>Cloud AI Deep Multi-Zone Enhancement</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">check</span>
                <span>Generative AI Object Removal & Inpaint</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">check</span>
                <span>AI Background Scene Synthesis</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">check</span>
                <span>Text-to-Image Generation (DALL-E / Gemini)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">check</span>
                <span>Full Original Resolution & Ultra 4K Exports</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">check</span>
                <span>10 GB Cloud Storage & Unlimited Projects</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">check</span>
                <span>All 100+ Pro Templates & Exclusive Film Looks</span>
              </div>
            </div>
          </div>

          {/* Processing and Error States */}
          {processingState === 'opening_checkout' && (
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[#C084FC] text-[12px] flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              <span>Connecting to secure Razorpay payment gateway...</span>
            </div>
          )}

          {processingState === 'verifying' && (
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[#22D3EE] text-[12px] flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              <span>Verifying payment with secure backend...</span>
            </div>
          )}

          {processingState === 'success' && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] font-bold flex items-center justify-center gap-2 animate-in zoom-in-95">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              <span>Payment Verified! Welcome to Chroma Studio Pro!</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[#F87171] text-[12px] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-white hover:underline text-[11px]"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Subscribe CTA Button */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleSubscribe}
              disabled={processingState !== 'idle' && processingState !== 'error'}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#F59E0B] text-white font-extrabold text-[15px] shadow-xl shadow-purple-950/40 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {processingState === 'opening_checkout' || processingState === 'verifying' ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  <span>Processing...</span>
                </>
              ) : isPro ? (
                <span>Switch / Renew Plan</span>
              ) : (
                <span>Subscribe Now with Razorpay</span>
              )}
            </button>

            {/* Terms and Cancellation Policy */}
            <p className="text-[11px] text-[#64748B] text-center leading-relaxed">
              Payments are securely processed via Razorpay (UPI, Credit/Debit Cards, NetBanking).
              Automatic recurring mandates apply where supported. You can cancel your subscription anytime from
              Account Settings with access preserved through the current billing period.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
