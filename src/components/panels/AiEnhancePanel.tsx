import React, { useState, useEffect, useRef } from 'react';
import type { AdjustmentParameters, EnhancementState } from '../../types/editor';
import {
  enhancementService,
  type EnhancementStrength,
  type EnhancementMode,
  type EnhancementResult,
} from '../../services/enhancement';
import { useSubscription } from '../../contexts/SubscriptionContext';

interface AiEnhancePanelProps {
  currentAdjustments: AdjustmentParameters;
  imageElement: HTMLImageElement | null;
  onApplyEnhancement: (params: Partial<AdjustmentParameters>, state: EnhancementState) => void;
  onPreviewEnhancement?: (previewParams: Partial<AdjustmentParameters> | null) => void;
  onClose?: () => void;
  onToggleCompare?: () => void;
  isComparing?: boolean;
}

export const AiEnhancePanel: React.FC<AiEnhancePanelProps> = ({
  currentAdjustments,
  imageElement,
  onApplyEnhancement,
  onPreviewEnhancement,
  onClose,
  onToggleCompare,
  isComparing = false,
}) => {
  const { checkFeatureAccess, isPro } = useSubscription();
  const [strength, setStrength] = useState<EnhancementStrength>('balanced');
  const [mode, setMode] = useState<EnhancementMode>('ai-local');
  const [hasUserConsent, setHasUserConsent] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<EnhancementResult | null>(null);
  const isPreviewingRef = useRef(false);

  // Auto-run enhancement on initial load or strength/mode change
  const runEnhancement = async (
    targetStrength: EnhancementStrength = strength,
    targetMode: EnhancementMode = mode,
    consent: boolean = hasUserConsent
  ) => {
    if (!imageElement) {
      setErrorMessage('Please load or select an image to enhance.');
      return;
    }

    if (targetMode === 'ai-cloud' && !consent) {
      setShowConsentModal(true);
      return;
    }

    if (isProcessing) {
      enhancementService.cancelCurrentOperation();
    }

    setIsProcessing(true);
    setProgressPercent(10);
    setProgressStatus('Initializing photometric analysis...');
    setErrorMessage(null);

    try {
      const res = await enhancementService.enhanceImage(imageElement, currentAdjustments, {
        strength: targetStrength,
        mode: targetMode,
        userConsent: consent,
        onProgress: (pct, status) => {
          setProgressPercent(pct);
          setProgressStatus(status);
        },
      });

      setResult(res);
      // Automatically preview the proposal
      onPreviewEnhancement?.(res.parameters);
      isPreviewingRef.current = true;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMessage(err.message || 'Image enhancement failed. Please try again.');
      }
    } finally {
      setIsProcessing(false);
      setProgressPercent(0);
      setProgressStatus('');
    }
  };

  // Run on mount if no result yet
  useEffect(() => {
    if (!result && imageElement && !isProcessing) {
      runEnhancement('balanced', 'ai-local');
    }
    return () => {
      // Clear preview on unmount if not committed
      if (isPreviewingRef.current) {
        onPreviewEnhancement?.(null);
      }
      enhancementService.cancelCurrentOperation();
    };
  }, []);

  const handleStrengthChange = (newStrength: EnhancementStrength) => {
    setStrength(newStrength);
    runEnhancement(newStrength, mode, hasUserConsent);
  };

  const handleModeChange = (newMode: EnhancementMode) => {
    if (newMode === 'ai-cloud') {
      const allowed = checkFeatureAccess(
        'ai_enhancement_pro',
        undefined,
        'Upgrade to Chroma Pro for Cloud AI deep multi-zone enhancement.'
      );
      if (!allowed) return;

      if (!hasUserConsent) {
        setShowConsentModal(true);
        return;
      }
    }
    setMode(newMode);
    runEnhancement(strength, newMode, hasUserConsent);
  };

  const handleConsentAccept = () => {
    const allowed = checkFeatureAccess(
      'ai_enhancement_pro',
      undefined,
      'Upgrade to Chroma Pro for Cloud AI deep multi-zone enhancement.'
    );
    if (!allowed) {
      setShowConsentModal(false);
      return;
    }
    setHasUserConsent(true);
    setShowConsentModal(false);
    setMode('ai-cloud');
    runEnhancement(strength, 'ai-cloud', true);
  };

  const handleCancelOperation = () => {
    enhancementService.cancelCurrentOperation();
    setIsProcessing(false);
    setProgressPercent(0);
    setProgressStatus('');
  };

  const handleApply = () => {
    if (!result) return;
    isPreviewingRef.current = false;
    onPreviewEnhancement?.(null);
    onApplyEnhancement(result.parameters, {
      applied: true,
      strength: result.strength,
      mode: result.mode,
      appliedAt: Date.now(),
      explanation: result.explanation,
    });
  };

  const handleDismiss = () => {
    isPreviewingRef.current = false;
    onPreviewEnhancement?.(null);
    onClose?.();
  };

  return (
    <div className="w-full bg-[#0D1424] border border-white/10 rounded-2xl p-3 sm:p-4 space-y-3.5 shadow-xl select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#8B5CF6]/30 to-[#EC4899]/30 text-[#C4B5FD] flex items-center justify-center border border-[#8B5CF6]/30 shadow-xs">
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-bold text-white tracking-wide">
                AI Image Enhancer
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold border border-[#8B5CF6]/40 bg-[#8B5CF6]/20 text-[#A78BFA]">
                {mode === 'ai-cloud' ? 'CLOUD AI' : mode === 'ai-local' ? 'ON-DEVICE AI' : 'ANALYTICAL'}
              </span>
            </div>
            <p className="text-[10px] text-[#94A3B8]">
              Intelligent lighting, natural skin color, and adaptive sharpness
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={handleDismiss}
            className="w-8 h-8 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer min-h-[44px] min-w-[44px]"
            title="Close Enhancer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

      {/* Strength Selector Chips */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            Enhancement Strength
          </span>
          <span className="text-[9px] text-[#64748B]">
            {strength === 'subtle' ? '50% Natural' : strength === 'balanced' ? '100% Calibrated' : '140% Dynamic Punch'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 bg-[#070B14]/60 p-1 rounded-xl border border-white/5">
          {(['subtle', 'balanced', 'strong'] as EnhancementStrength[]).map((s) => {
            const isSelected = strength === s;
            return (
              <button
                key={s}
                onClick={() => handleStrengthChange(s)}
                disabled={isProcessing}
                className={`py-2 px-2 rounded-lg text-[11px] font-medium flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer min-h-[44px] ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white font-semibold shadow-xs'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="capitalize">{s}</span>
                <span className="text-[8px] opacity-80">
                  {s === 'subtle' ? 'Gentle' : s === 'balanced' ? 'Standard' : 'Punchy'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode Selector (Local AI vs Cloud AI vs Analytical) */}
      <div className="grid grid-cols-3 gap-1 bg-[#070B14]/40 p-1 rounded-xl border border-white/5">
        <button
          onClick={() => handleModeChange('ai-local')}
          disabled={isProcessing}
          className={`py-1.5 px-1 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer min-h-[38px] ${
            mode === 'ai-local'
              ? 'bg-[#8B5CF6] text-white font-semibold'
              : 'text-[#94A3B8] hover:text-white'
          }`}
          title="On-device neural vision (100% private & offline)"
        >
          <span className="material-symbols-outlined text-[13px]">lock</span>
          <span>On-Device AI</span>
        </button>

        <button
          onClick={() => handleModeChange('ai-cloud')}
          disabled={isProcessing}
          className={`py-1.5 px-1 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer min-h-[38px] ${
            mode === 'ai-cloud'
              ? 'bg-[#8B5CF6] text-white font-semibold'
              : 'text-[#94A3B8] hover:text-white'
          }`}
          title="Cloud AI deep multi-zone enhancement (Chroma Pro)"
        >
          <span className="material-symbols-outlined text-[13px]">cloud</span>
          <span>Cloud AI (HD)</span>
          {!isPro && (
            <span className="text-[9px] font-black px-1 py-0.2 rounded bg-amber-400 text-black">PRO</span>
          )}
        </button>

        <button
          onClick={() => handleModeChange('analytical')}
          disabled={isProcessing}
          className={`py-1.5 px-1 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer min-h-[38px] ${
            mode === 'analytical'
              ? 'bg-[#8B5CF6] text-white font-semibold'
              : 'text-[#94A3B8] hover:text-white'
          }`}
          title="Standard statistical histogram balance (non-AI)"
        >
          <span className="material-symbols-outlined text-[13px]">tune</span>
          <span>Analytical</span>
        </button>
      </div>

      {/* Processing Progress Bar */}
      {isProcessing && (
        <div className="p-3 bg-[#070B14]/80 border border-[#8B5CF6]/40 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 text-[#C4B5FD]">
              <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
              <span className="font-semibold">{progressStatus || 'Enhancing photograph...'}</span>
            </div>
            <span className="font-mono text-white text-[10px]">{progressPercent}%</span>
          </div>

          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#8B5CF6] via-[#A855F7] to-[#EC4899] transition-all duration-200"
              style={{ width: `${Math.max(5, progressPercent)}%` }}
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleCancelOperation}
              className="px-3 py-1 text-[10px] font-medium text-[#F43F5E] hover:bg-[#F43F5E]/10 rounded-lg transition-colors cursor-pointer min-h-[36px]"
            >
              Cancel Processing
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 bg-[#F43F5E]/10 border border-[#F43F5E]/30 rounded-xl text-[#FDA4AF] text-[11px] flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Proposal Summary Card & Before/After Comparison */}
      {result && !isProcessing && (
        <div className="space-y-3 pt-1">
          {/* Explanation Card */}
          <div className="p-3 bg-[#070B14]/70 border border-white/5 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#A78BFA] uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">verified</span>
                <span>Optimizations Identified</span>
              </span>
              <span className="text-[9px] font-mono text-[#64748B]">
                {result.durationMs}ms
              </span>
            </div>
            <p className="text-[11px] text-[#E2E8F0] leading-relaxed">
              {result.explanation}
            </p>

            {/* Parameter Badges */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(result.parameters.exposure || 0) !== 0 && (
                <span className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] text-white font-mono border border-white/10">
                  Exp: {result.parameters.exposure! > 0 ? `+${result.parameters.exposure}` : result.parameters.exposure} EV
                </span>
              )}
              {(result.parameters.contrast || 0) !== 0 && (
                <span className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] text-white font-mono border border-white/10">
                  Contrast: +{result.parameters.contrast}
                </span>
              )}
              {(result.parameters.shadows || 0) !== 0 && (
                <span className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] text-white font-mono border border-white/10">
                  Shadows: +{result.parameters.shadows}
                </span>
              )}
              {(result.parameters.vibrance || 0) !== 0 && (
                <span className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] text-white font-mono border border-white/10">
                  Vibrance: +{result.parameters.vibrance}
                </span>
              )}
              {(result.parameters.sharpen || 0) !== 0 && (
                <span className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] text-white font-mono border border-white/10">
                  Sharpen: +{result.parameters.sharpen}
                </span>
              )}
            </div>
          </div>

          {/* Action Row: Compare, Retry, Cancel, Apply */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            {/* Compare Toggle */}
            {onToggleCompare && (
              <button
                onClick={onToggleCompare}
                className={`w-full sm:w-auto px-3 py-2.5 rounded-xl text-[11px] font-medium border flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                  isComparing
                    ? 'border-[#8B5CF6] bg-[#8B5CF6]/20 text-white font-semibold'
                    : 'border-white/10 bg-[#070B14]/60 text-[#94A3B8] hover:text-white'
                }`}
                title="Hold or tap to compare original"
              >
                <span className="material-symbols-outlined text-[15px]">
                  {isComparing ? 'visibility' : 'visibility_off'}
                </span>
                <span>{isComparing ? 'Original' : 'Compare'}</span>
              </button>
            )}

            <button
              onClick={() => runEnhancement(strength, mode, hasUserConsent)}
              className="w-full sm:w-auto px-3 py-2.5 rounded-xl text-[11px] font-medium border border-white/10 bg-[#070B14]/60 text-[#94A3B8] hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
              title="Re-run enhancement analysis"
            >
              <span className="material-symbols-outlined text-[15px]">refresh</span>
              <span>Retry</span>
            </button>

            <button
              onClick={handleDismiss}
              className="w-full sm:w-auto px-3 py-2.5 rounded-xl text-[11px] font-medium border border-white/10 bg-white/5 text-[#94A3B8] hover:text-white flex items-center justify-center transition-colors cursor-pointer min-h-[44px]"
            >
              Discard
            </button>

            <button
              onClick={handleApply}
              className="w-full flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#8B5CF6] via-[#7C3AED] to-[#EC4899] text-white text-[12px] font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-[#8B5CF6]/25 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer min-h-[44px]"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              <span>Apply Enhancement</span>
            </button>
          </div>
        </div>
      )}

      {/* Cloud AI Privacy Disclosure Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#0D1424] border border-[#8B5CF6]/30 max-w-sm w-full rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/20 text-[#A78BFA] flex items-center justify-center border border-[#8B5CF6]/30 shrink-0">
                <span className="material-symbols-outlined text-[22px]">security</span>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-white">Cloud AI Privacy Notice</h3>
                <p className="text-[10px] text-[#94A3B8]">Your privacy is protected</p>
              </div>
            </div>

            <p className="text-[12px] text-[#CBD5E1] leading-relaxed">
              When using <strong>Cloud AI (HD)</strong>, your photo metrics are encrypted in transit and securely analyzed by Chroma Studio's private edge function.
            </p>

            <ul className="text-[11px] text-[#94A3B8] space-y-1.5 list-disc pl-4">
              <li>Image metrics are analyzed ephemerally in RAM and never stored on disk.</li>
              <li>Your photos are never used to train models or shared with third parties.</li>
              <li>You can use <strong>On-Device AI</strong> for 100% offline, local execution.</li>
            </ul>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  setShowConsentModal(false);
                  setMode('ai-local');
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 text-white text-[11px] font-medium hover:bg-white/15 transition-colors cursor-pointer min-h-[44px]"
              >
                Use On-Device
              </button>
              <button
                onClick={handleConsentAccept}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#8B5CF6] text-white text-[11px] font-bold hover:bg-[#7C3AED] transition-colors cursor-pointer min-h-[44px] shadow-md shadow-[#8B5CF6]/20"
              >
                I Consent & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
