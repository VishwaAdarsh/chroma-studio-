import React, { useState } from 'react';
import type { ExportSettings } from '../types/editor';
import { useSubscription } from '../contexts/SubscriptionContext';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalWidth: number;
  originalHeight: number;
  onExport: (settings: ExportSettings) => Promise<void>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  originalWidth,
  originalHeight,
  onExport,
}) => {
  const { checkFeatureAccess, isPro } = useSubscription();
  const [format, setFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg');
  const [quality, setQuality] = useState<number>(0.92);
  const [scale, setScale] = useState<number>(1);
  const [stripMetadata, setStripMetadata] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  if (!isOpen) return null;

  const exportW = Math.round(originalWidth * scale);
  const exportH = Math.round(originalHeight * scale);

  const megaPixels = (exportW * exportH) / 1_000_000;
  let estimatedMB = 0;
  if (format === 'png') {
    estimatedMB = +(megaPixels * 1.8).toFixed(1);
  } else if (format === 'webp') {
    estimatedMB = +(megaPixels * quality * 0.45).toFixed(1);
  } else {
    estimatedMB = +(megaPixels * quality * 0.65).toFixed(1);
  }
  if (estimatedMB < 0.1) estimatedMB = 0.1;

  const handleExportClick = async () => {
    setIsExporting(true);
    try {
      await onExport({ format, quality, scale, stripMetadata });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-surface-container-low border border-outline-variant rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-4 text-on-surface max-h-[92dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">ios_share</span>
            </div>
            <div>
              <h3 className="font-semibold text-[16px] text-on-surface">Export Master Image</h3>
              <p className="text-[11px] text-on-surface-variant">High-fidelity master render</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Resolution & Dimensions info banner */}
        <div className="flex items-center justify-between bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-xs">
          <div>
            <span className="text-[10px] text-outline block">OUTPUT RESOLUTION</span>
            <span className="text-[14px] font-mono font-semibold text-on-surface">
              {exportW} × {exportH} px
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-outline block">ESTIMATED SIZE</span>
            <span className="text-[14px] font-mono font-semibold text-primary">
              ~{estimatedMB} MB
            </span>
          </div>
        </div>

        {/* Format Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase text-on-surface-variant">Image Format</label>
          <div className="grid grid-cols-3 gap-2">
            {(['jpeg', 'png', 'webp'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setFormat(fmt)}
                className={`py-2 rounded-xl text-[12px] font-semibold uppercase transition-all ${
                  format === fmt
                    ? 'bg-primary-container text-white shadow-sm shadow-primary-container/20'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high border border-outline-variant'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Scale Multiplier */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase text-on-surface-variant">Target Scale</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Original (1×)', value: 1, isPro: false },
              { label: '2K (1.5×)', value: 1.5, isPro: false },
              { label: '4K Ultra (2×)', value: 2, isPro: true },
              { label: '50%', value: 0.5, isPro: false },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  if (opt.isPro) {
                    const allowed = checkFeatureAccess(
                      'export_4k_lossless',
                      undefined,
                      'Upgrade to Chroma Pro for 4K Ultra resolution exports.'
                    );
                    if (!allowed) return;
                  }
                  setScale(opt.value);
                }}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all relative ${
                  scale === opt.value
                    ? 'bg-primary text-white border border-primary'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border border-outline-variant'
                }`}
              >
                <span>{opt.label}</span>
                {opt.isPro && !isPro && (
                  <span className="block text-[8px] font-black text-amber-400">PRO</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Quality Slider (for JPEG / WebP) */}
        {format !== 'png' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase text-on-surface-variant">
                Compression Quality
              </label>
              <span className="text-[11px] font-mono text-primary font-bold">
                {Math.round(quality * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={quality}
              onChange={(e) => setQuality(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-surface-container-high rounded-full accent-primary"
            />
          </div>
        )}

        {/* Privacy: Strip EXIF metadata toggle */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant shadow-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-600">security</span>
            <div>
              <span className="text-[12px] font-medium text-on-surface block">
                Strip GPS & Location EXIF
              </span>
              <span className="text-[10px] text-outline">
                Preserves privacy before publishing
              </span>
            </div>
          </div>
          <button
            onClick={() => setStripMetadata(!stripMetadata)}
            className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
              stripMetadata ? 'bg-primary justify-end' : 'bg-outline-variant justify-start'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-white shadow-md" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-surface-container-high text-[13px] font-semibold text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant cursor-pointer touch-manipulation"
          >
            Cancel
          </button>
          <button
            onClick={handleExportClick}
            disabled={isExporting}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-primary-container text-white font-semibold text-[13px] shadow-lg shadow-primary-container/25 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer touch-manipulation"
          >
            {isExporting ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                <span>Rendering...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span>Save to Device</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
