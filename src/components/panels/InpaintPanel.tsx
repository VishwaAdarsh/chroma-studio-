import React, { useState } from 'react';
import { Scrubber } from '../Scrubber';
import { useSubscription } from '../../contexts/SubscriptionContext';

interface InpaintPanelProps {
  onRunInpaint: (provider: 'on-device' | 'cloud-ai', userConsent: boolean) => Promise<void>;
  isProcessing: boolean;
  progressPercent: number;
  progressStatus: string;
  onCancelProcessing?: () => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  brushMode: 'brush' | 'eraser';
  onBrushModeChange: (mode: 'brush' | 'eraser') => void;
  onUndoStroke: () => void;
  onRedoStroke: () => void;
  canUndoStroke: boolean;
  canRedoStroke: boolean;
  onClearMask: () => void;
  onApply: () => void;
  onDiscard: () => void;
  onRetry: () => void;
  hasResult: boolean;
  onToggleCompare?: () => void;
  isComparing?: boolean;
  feather?: number;
  onFeatherChange?: (val: number) => void;
  onClose?: () => void;
}

export const InpaintPanel: React.FC<InpaintPanelProps> = ({
  onRunInpaint,
  isProcessing,
  progressPercent,
  progressStatus,
  onCancelProcessing,
  brushSize,
  onBrushSizeChange,
  brushMode,
  onBrushModeChange,
  onUndoStroke,
  onRedoStroke,
  canUndoStroke,
  canRedoStroke,
  onClearMask,
  onApply,
  onDiscard,
  onRetry,
  hasResult,
  onToggleCompare,
  isComparing = false,
  feather = 3,
  onFeatherChange,
  onClose,
}) => {
  const { checkFeatureAccess, isPro } = useSubscription();
  const [selectedProvider, setSelectedProvider] = useState<'on-device' | 'cloud-ai'>('on-device');
  const [hasUserConsent, setHasUserConsent] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const handleExecute = async () => {
    if (isProcessing) return;
    if (selectedProvider === 'cloud-ai') {
      const allowed = checkFeatureAccess(
        'ai_inpaint_unlimited',
        undefined,
        'Upgrade to Chroma Pro for Cloud AI Generative Object Removal & Inpainting.'
      );
      if (!allowed) return;

      if (!hasUserConsent) {
        setShowConsentModal(true);
        return;
      }
    }
    await onRunInpaint(selectedProvider, hasUserConsent);
  };

  const handleConsentAccept = async () => {
    const allowed = checkFeatureAccess(
      'ai_inpaint_unlimited',
      undefined,
      'Upgrade to Chroma Pro for Cloud AI Generative Object Removal & Inpainting.'
    );
    if (!allowed) {
      setShowConsentModal(false);
      return;
    }
    setHasUserConsent(true);
    setShowConsentModal(false);
    setSelectedProvider('cloud-ai');
    await onRunInpaint('cloud-ai', true);
  };

  return (
    <div className="w-full bg-[#0D1424] border border-white/10 rounded-2xl p-3 sm:p-4 space-y-3.5 shadow-xl select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#EC4899]/25 to-[#8B5CF6]/25 text-[#F472B6] flex items-center justify-center border border-[#EC4899]/30 shadow-xs">
            <span className="material-symbols-outlined text-[20px]">cleaning_services</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-bold text-white tracking-wide">
                AI Object Removal
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold border border-[#EC4899]/40 bg-[#EC4899]/20 text-[#F472B6]">
                {selectedProvider === 'cloud-ai' ? 'CLOUD AI' : 'ON-DEVICE'}
              </span>
            </div>
            <p className="text-[10px] text-[#94A3B8]">
              Paint over unwanted people or objects to remove them seamlessly
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer min-h-[44px] min-w-[44px]"
            title="Close Object Removal"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

      {/* Brush / Eraser Mode Chips & Stroke Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-[#070B14]/60 p-1.5 rounded-xl border border-white/5">
        {/* Draw vs Erase Mode */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onBrushModeChange('brush')}
            className={`py-1.5 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer min-h-[40px] ${
              brushMode === 'brush'
                ? 'bg-[#EC4899] text-white font-semibold shadow-xs'
                : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
            }`}
            title="Paint over object to remove"
          >
            <span className="material-symbols-outlined text-[16px]">brush</span>
            <span>Brush</span>
          </button>

          <button
            onClick={() => onBrushModeChange('eraser')}
            className={`py-1.5 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer min-h-[40px] ${
              brushMode === 'eraser'
                ? 'bg-[#8B5CF6] text-white font-semibold shadow-xs'
                : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
            }`}
            title="Erase or trim mask edges"
          >
            <span className="material-symbols-outlined text-[16px]">ink_eraser</span>
            <span>Eraser</span>
          </button>
        </div>

        {/* Undo, Redo, Clear Stroke Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onUndoStroke}
            disabled={!canUndoStroke || isProcessing}
            className={`p-2 rounded-lg text-[12px] flex items-center justify-center transition-colors cursor-pointer min-h-[40px] min-w-[40px] ${
              canUndoStroke && !isProcessing
                ? 'text-white hover:bg-white/10'
                : 'text-white/20 cursor-not-allowed'
            }`}
            title="Undo Mask Stroke"
          >
            <span className="material-symbols-outlined text-[16px]">undo</span>
          </button>

          <button
            onClick={onRedoStroke}
            disabled={!canRedoStroke || isProcessing}
            className={`p-2 rounded-lg text-[12px] flex items-center justify-center transition-colors cursor-pointer min-h-[40px] min-w-[40px] ${
              canRedoStroke && !isProcessing
                ? 'text-white hover:bg-white/10'
                : 'text-white/20 cursor-not-allowed'
            }`}
            title="Redo Mask Stroke"
          >
            <span className="material-symbols-outlined text-[16px]">redo</span>
          </button>

          <button
            onClick={onClearMask}
            disabled={isProcessing}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-[#FDA4AF] hover:bg-[#F43F5E]/15 flex items-center gap-1 transition-colors cursor-pointer min-h-[40px]"
            title="Clear Mask Selection"
          >
            <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Brush Size Scrubber */}
      <Scrubber
        label="Brush Size (Radius)"
        value={brushSize}
        min={5}
        max={100}
        step={1}
        unit="px"
        onChange={onBrushSizeChange}
        onReset={() => onBrushSizeChange(25)}
      />

      {/* Provider Selector: On-Device vs Cloud AI */}
      <div className="grid grid-cols-2 gap-1.5 bg-[#070B14]/40 p-1 rounded-xl border border-white/5">
        <button
          onClick={() => setSelectedProvider('on-device')}
          disabled={isProcessing}
          className={`py-2 px-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[40px] ${
            selectedProvider === 'on-device'
              ? 'bg-[#8B5CF6] text-white font-semibold shadow-xs'
              : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
          }`}
          title="100% private, runs offline on your device"
        >
          <span className="material-symbols-outlined text-[14px]">lock</span>
          <span>On-Device (Private)</span>
        </button>

        <button
          onClick={() => {
            const allowed = checkFeatureAccess(
              'ai_inpaint_unlimited',
              undefined,
              'Upgrade to Chroma Pro for Cloud AI Generative Object Removal & Inpainting.'
            );
            if (!allowed) return;
            setSelectedProvider('cloud-ai');
            if (!hasUserConsent) setShowConsentModal(true);
          }}
          disabled={isProcessing}
          className={`py-2 px-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[40px] ${
            selectedProvider === 'cloud-ai'
              ? 'bg-[#8B5CF6] text-white font-semibold shadow-xs'
              : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
          }`}
          title="Cloud AI deep generative inpainting (Chroma Pro)"
        >
          <span className="material-symbols-outlined text-[14px]">cloud</span>
          <span>Cloud AI (HD)</span>
          {!isPro && (
            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-400 text-black">PRO</span>
          )}
        </button>
      </div>

      {/* Processing State */}
      {isProcessing && (
        <div className="p-3 bg-[#070B14]/80 border border-[#EC4899]/40 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 text-[#F472B6]">
              <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
              <span className="font-semibold">{progressStatus || 'Inpainting masked area...'}</span>
            </div>
            <span className="font-mono text-white text-[10px]">{progressPercent}%</span>
          </div>

          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#EC4899] via-[#A855F7] to-[#8B5CF6] transition-all duration-200"
              style={{ width: `${Math.max(5, progressPercent)}%` }}
            />
          </div>

          {onCancelProcessing && (
            <div className="flex justify-end pt-1">
              <button
                onClick={onCancelProcessing}
                className="px-3 py-1 text-[10px] font-medium text-[#F43F5E] hover:bg-[#F43F5E]/10 rounded-lg transition-colors cursor-pointer min-h-[36px]"
              >
                Cancel Processing
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action Row */}
      {!isProcessing && (
        <div className="space-y-2 pt-1">
          {hasResult ? (
            <div className="flex flex-col sm:flex-row items-center gap-2">
              {/* Compare Button */}
              {onToggleCompare && (
                <button
                  onClick={onToggleCompare}
                  className={`w-full sm:w-auto px-3 py-2.5 rounded-xl text-[11px] font-medium border flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                    isComparing
                      ? 'border-[#EC4899] bg-[#EC4899]/20 text-white font-semibold'
                      : 'border-white/10 bg-[#070B14]/60 text-[#94A3B8] hover:text-white'
                  }`}
                  title="Toggle before/after comparison"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {isComparing ? 'visibility' : 'visibility_off'}
                  </span>
                  <span>{isComparing ? 'Original' : 'Compare'}</span>
                </button>
              )}

              <button
                onClick={onRetry}
                className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl text-[11px] font-medium border border-white/10 bg-[#070B14]/60 text-[#94A3B8] hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                title="Retry with adjusted mask or provider"
              >
                <span className="material-symbols-outlined text-[15px]">refresh</span>
                <span>Retry</span>
              </button>

              <button
                onClick={onDiscard}
                className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl text-[11px] font-medium border border-white/10 bg-white/5 text-[#94A3B8] hover:text-white flex items-center justify-center transition-colors cursor-pointer min-h-[44px]"
              >
                Discard
              </button>

              <button
                onClick={onApply}
                className="w-full flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#EC4899] via-[#A855F7] to-[#8B5CF6] text-white text-[12px] font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-[#EC4899]/20 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer min-h-[44px]"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Apply Removal</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleExecute}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#EC4899] via-[#A855F7] to-[#8B5CF6] text-white text-[12px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#EC4899]/25 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer min-h-[44px]"
            >
              <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
              <span>Remove Object (AI)</span>
            </button>
          )}
        </div>
      )}

      {/* Cloud AI Privacy Disclosure Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#0D1424] border border-[#EC4899]/30 max-w-sm w-full rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EC4899]/20 text-[#F472B6] flex items-center justify-center border border-[#EC4899]/30 shrink-0">
                <span className="material-symbols-outlined text-[22px]">security</span>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-white">Cloud AI Inpainting Notice</h3>
                <p className="text-[10px] text-[#94A3B8]">Your privacy is protected</p>
              </div>
            </div>

            <p className="text-[12px] text-[#CBD5E1] leading-relaxed">
              When using <strong>Cloud AI (HD)</strong>, your masked image patch is encrypted in transit and securely reconstructed by Chroma Studio's private edge function.
            </p>

            <ul className="text-[11px] text-[#94A3B8] space-y-1.5 list-disc pl-4">
              <li>Image regions are analyzed ephemerally in RAM and never stored on disk.</li>
              <li>Your photos are never used to train models or shared with third parties.</li>
              <li>You can use <strong>On-Device</strong> for 100% offline, local execution.</li>
            </ul>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  setShowConsentModal(false);
                  setSelectedProvider('on-device');
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 text-white text-[11px] font-medium hover:bg-white/15 transition-colors cursor-pointer min-h-[44px]"
              >
                Use On-Device
              </button>
              <button
                onClick={handleConsentAccept}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#EC4899] text-white text-[11px] font-bold hover:bg-[#DB2777] transition-colors cursor-pointer min-h-[44px] shadow-md shadow-[#EC4899]/25"
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
