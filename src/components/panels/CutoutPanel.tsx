import React, { useState } from 'react';
import type { CutoutState } from '../../types/editor';
import { Scrubber } from '../Scrubber';

interface CutoutPanelProps {
  cutout: CutoutState;
  onChange: (cutout: CutoutState) => void;
  onReset: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  onRunAiSegmentation?: (provider: 'on-device' | 'cloud', userConsent: boolean) => Promise<void>;
  isProcessing?: boolean;
  progressPercent?: number;
  progressStatus?: string;
  onCancel?: () => void;
  onToggleCompare?: () => void;
  isComparing?: boolean;
  onOpenBackdrop?: () => void;
}

const MATTE_COLORS = [
  { id: 'white', label: 'White', color: '#FFFFFF' },
  { id: 'black', label: 'Dark Studio', color: '#070B14' },
  { id: 'slate', label: 'Slate Gray', color: '#64748B' },
  { id: 'sand', label: 'Warm Sand', color: '#F5EBE0' },
  { id: 'violet', label: 'Studio Violet', color: '#1E1B4B' },
];

export const CutoutPanel: React.FC<CutoutPanelProps> = ({
  cutout,
  onChange,
  onReset,
  onInteractionStart,
  onInteractionEnd,
  onRunAiSegmentation,
  isProcessing = false,
  progressPercent = 0,
  progressStatus = '',
  onCancel,
  onToggleCompare,
  isComparing = false,
  onOpenBackdrop,
}) => {
  const isEnabled = cutout.enabled;
  const [selectedProvider, setSelectedProvider] = useState<'on-device' | 'cloud'>(
    cutout.provider || 'on-device'
  );
  const [showConsentModal, setShowConsentModal] = useState(false);

  const handleToggle = () => {
    onInteractionStart?.();
    onChange({
      ...cutout,
      enabled: !isEnabled,
      mode: cutout.mode || 'ai',
    });
    onInteractionEnd?.();
  };

  const handleModeChange = (mode: 'ai' | 'auto' | 'color') => {
    onInteractionStart?.();
    onChange({
      ...cutout,
      mode,
    });
    onInteractionEnd?.();
  };

  const handleToleranceChange = (val: number) => {
    onChange({
      ...cutout,
      tolerance: val,
    });
  };

  const handleFeatherChange = (val: number) => {
    onChange({
      ...cutout,
      feather: val,
    });
  };

  const handleToggleInvert = () => {
    onInteractionStart?.();
    onChange({
      ...cutout,
      invert: !cutout.invert,
    });
    onInteractionEnd?.();
  };

  const handleMatteSelect = (colorHex: string) => {
    onInteractionStart?.();
    onChange({
      ...cutout,
      matteColor: colorHex,
    });
    onInteractionEnd?.();
  };

  const handleExecuteAi = async () => {
    if (isProcessing) return;
    if (selectedProvider === 'cloud' && !cutout.hasUserConsent) {
      setShowConsentModal(true);
      return;
    }
    if (onRunAiSegmentation) {
      await onRunAiSegmentation(selectedProvider, Boolean(cutout.hasUserConsent));
    } else {
      onChange({
        ...cutout,
        enabled: true,
        mode: 'ai',
        provider: selectedProvider,
      });
    }
  };

  const handleConsentAccept = async () => {
    setShowConsentModal(false);
    onChange({
      ...cutout,
      hasUserConsent: true,
    });
    if (onRunAiSegmentation) {
      await onRunAiSegmentation('cloud', true);
    }
  };

  return (
    <div className="w-full bg-[#0D1424] border border-white/10 rounded-2xl p-3 sm:p-4 space-y-3.5 shadow-lg select-none">
      {/* Top Banner: Master Enable/Disable & Reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/15 text-[#A78BFA] flex items-center justify-center border border-[#8B5CF6]/20 shadow-xs">
            <span className="material-symbols-outlined text-[20px]">person_remove</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-bold text-white tracking-wide">
                AI Background Remover
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/25 text-[#C4B5FD] font-mono font-bold border border-[#8B5CF6]/30">
                {selectedProvider === 'cloud' ? 'CLOUD AI' : 'ON-DEVICE AI'}
              </span>
            </div>
            <p className="text-[10px] text-[#94A3B8]">
              {isEnabled
                ? 'Subject isolated with anti-aliased alpha transparency'
                : 'Extract subject and erase background with genuine transparency'}
            </p>
          </div>
        </div>

        {/* Master Switch and Reset */}
        <div className="flex items-center gap-2">
          {isEnabled && (
            <button
              onClick={onReset}
              className="text-[10px] text-[#94A3B8] hover:text-white flex items-center gap-1 transition-colors cursor-pointer min-h-[44px] px-2.5 rounded-lg hover:bg-white/5 active:scale-95"
              title="Reset cutout settings"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              <span className="hidden xs:inline">Reset</span>
            </button>
          )}

          <button
            onClick={handleToggle}
            className={`w-12 h-6.5 rounded-full transition-all p-0.5 flex items-center cursor-pointer min-h-[44px] focus:outline-hidden ${
              isEnabled ? 'bg-[#8B5CF6] justify-end' : 'bg-white/10 justify-start'
            }`}
            title={isEnabled ? 'Disable cutout' : 'Enable cutout'}
            aria-label="Toggle background removal"
          >
            <div className="w-5.5 h-5.5 rounded-full bg-white shadow-md transition-transform" />
          </button>
        </div>
      </div>

      {/* Main AI Trigger Button & Progress Indicator */}
      <div className="space-y-2">
        {isProcessing ? (
          <div className="p-3 bg-[#070B14]/80 border border-[#8B5CF6]/40 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2 text-[#A78BFA]">
                <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                <span className="font-semibold">{progressStatus || 'Removing background...'}</span>
              </div>
              <span className="font-mono text-white text-[10px]">{progressPercent}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] transition-all duration-200"
                style={{ width: `${Math.max(5, progressPercent)}%` }}
              />
            </div>

            {/* Cancel Button */}
            {onCancel && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={onCancel}
                  className="px-3 py-1 text-[10px] font-medium text-[#F43F5E] hover:bg-[#F43F5E]/10 rounded-lg transition-colors cursor-pointer min-h-[36px]"
                >
                  Cancel Processing
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleExecuteAi}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#8B5CF6] via-[#7C3AED] to-[#EC4899] text-white text-[12px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#8B5CF6]/20 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer min-h-[44px]"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>{isEnabled ? 'Re-Segment Foreground' : 'Remove Background (AI)'}</span>
            </button>

            {/* Hold to Compare Toggle Button */}
            {onToggleCompare && isEnabled && (
              <button
                onClick={onToggleCompare}
                className={`px-3 py-2 rounded-xl text-[11px] font-medium border flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                  isComparing
                    ? 'border-[#8B5CF6] bg-[#8B5CF6]/20 text-white font-semibold'
                    : 'border-white/10 bg-[#070B14]/60 text-[#94A3B8] hover:text-white'
                }`}
                title="Compare original photo with cutout"
              >
                <span className="material-symbols-outlined text-[15px]">
                  {isComparing ? 'visibility' : 'visibility_off'}
                </span>
                <span>{isComparing ? 'Showing Original' : 'Compare Original'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {isEnabled && (
        <>
          {/* Provider Selector: On-Device vs Cloud AI */}
          <div className="grid grid-cols-2 gap-1.5 bg-[#070B14]/60 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setSelectedProvider('on-device')}
              className={`py-2 px-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                selectedProvider === 'on-device'
                  ? 'bg-[#8B5CF6] text-white font-semibold shadow-xs'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">lock</span>
              <span>On-Device (Private)</span>
            </button>

            <button
              onClick={() => {
                setSelectedProvider('cloud');
                if (!cutout.hasUserConsent) setShowConsentModal(true);
              }}
              className={`py-2 px-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                selectedProvider === 'cloud'
                  ? 'bg-[#8B5CF6] text-white font-semibold shadow-xs'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">cloud</span>
              <span>Cloud AI (HD)</span>
            </button>
          </div>

          {/* Mode Selector Chips */}
          <div className="grid grid-cols-3 gap-1.5 bg-[#070B14]/40 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => handleModeChange('ai')}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer min-h-[38px] ${
                cutout.mode === 'ai'
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">psychology</span>
              <span>AI Neural</span>
            </button>

            <button
              onClick={() => handleModeChange('auto')}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer min-h-[38px] ${
                cutout.mode === 'auto'
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">blur_circular</span>
              <span>Boundary</span>
            </button>

            <button
              onClick={() => handleModeChange('color')}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer min-h-[38px] ${
                cutout.mode === 'color'
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">colorize</span>
              <span>Color Key</span>
            </button>
          </div>

          {/* Detection Sensitivity / Tolerance Scrubber */}
          <Scrubber
            label="Detection Sensitivity / Threshold"
            value={cutout.tolerance}
            min={5}
            max={95}
            step={1}
            unit="%"
            onChange={handleToleranceChange}
            onReset={() => handleToleranceChange(35)}
            onInteractionStart={onInteractionStart}
            onInteractionEnd={onInteractionEnd}
          />

          {/* Edge Feathering (Softness) Scrubber */}
          <Scrubber
            label="Edge Feathering (Hair & Soft Contours)"
            value={cutout.feather}
            min={0}
            max={20}
            step={1}
            unit="px"
            onChange={handleFeatherChange}
            onReset={() => handleFeatherChange(4)}
            onInteractionStart={onInteractionStart}
            onInteractionEnd={onInteractionEnd}
          />

          {/* Invert Selection Toggle */}
          <div className="flex items-center justify-between p-2.5 bg-[#070B14]/50 rounded-xl border border-white/5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-[#A78BFA]">invert_colors</span>
              <span className="text-[11px] font-medium text-white">Invert Mask Selection</span>
            </div>
            <button
              onClick={handleToggleInvert}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer min-h-[40px] flex items-center gap-1.5 ${
                cutout.invert
                  ? 'bg-[#8B5CF6] text-white shadow-xs'
                  : 'bg-white/10 text-[#94A3B8] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {cutout.invert ? 'check_circle' : 'swap_horiz'}
              </span>
              <span>{cutout.invert ? 'Background Kept' : 'Subject Kept'}</span>
            </button>
          </div>

          {/* Intentional Matte Color for Non-Alpha Export (JPEG) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                JPEG Export Matte Color
              </span>
              <span className="text-[9px] text-[#64748B]">
                PNG & WebP export with true transparency
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {MATTE_COLORS.map((m) => {
                const isSelected = (cutout.matteColor || '#FFFFFF').toLowerCase() === m.color.toLowerCase();
                return (
                  <button
                    key={m.id}
                    onClick={() => handleMatteSelect(m.color)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all cursor-pointer min-h-[44px] ${
                      isSelected
                        ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-white shadow-xs'
                        : 'border-white/10 bg-[#070B14]/60 text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: m.color }}
                    />
                    <span className="text-[10px] font-medium whitespace-nowrap">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {onOpenBackdrop && (
            <div className="pt-2 border-t border-white/5">
              <button
                onClick={onOpenBackdrop}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-[#8B5CF6]/20 to-[#EC4899]/20 hover:from-[#8B5CF6]/30 hover:to-[#EC4899]/30 text-white rounded-xl border border-[#8B5CF6]/30 flex items-center justify-between text-[11px] font-semibold cursor-pointer transition-all active:scale-98 min-h-[44px]"
              >
                <div className="flex items-center gap-2 text-[#C4B5FD]">
                  <span className="material-symbols-outlined text-[18px]">wallpaper</span>
                  <span>Replace Background (Color, Image, AI)</span>
                </div>
                <div className="flex items-center gap-1 text-[#EC4899] text-[10px]">
                  <span>Customize</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </div>
              </button>
            </div>
          )}
        </>
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
              When using <strong>Cloud AI (HD)</strong>, your photo is encrypted in transit and securely processed by Chroma Studio's private edge function.
            </p>

            <ul className="text-[11px] text-[#94A3B8] space-y-1.5 list-disc pl-4">
              <li>Images are processed ephemerally in RAM and never stored on disk.</li>
              <li>Your photos are never used to train models or shared with third parties.</li>
              <li>You can switch back to <strong>On-Device</strong> at any time for 100% offline privacy.</li>
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
