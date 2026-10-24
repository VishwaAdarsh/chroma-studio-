import React, { useState } from 'react';
import type { HistogramData } from '../types/editor';

interface CanvasViewProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  originalImageSrc: string;
  isComparing: boolean;
  zoomLevel: number;
  histogram: HistogramData | null;
  currentEV: number;
  activeAspect: string;
  onAutoTone: () => void;
  onOpenColorLab: () => void;
}

export const CanvasView: React.FC<CanvasViewProps> = ({
  canvasRef,
  originalImageSrc,
  isComparing,
  zoomLevel,
  histogram,
  currentEV,
  activeAspect,
  onAutoTone,
  onOpenColorLab,
}) => {
  const [showGrid, setShowGrid] = useState(false);
  const [wandAnimating, setWandAnimating] = useState(false);

  const handleMagicAutoTone = () => {
    setWandAnimating(true);
    onAutoTone();
    setTimeout(() => setWandAnimating(false), 300);
  };

  // Generate SVG histogram path
  const getHistogramPath = (data: number[] | undefined, maxCount: number) => {
    if (!data || data.length === 0 || maxCount === 0) return '';
    const points: string[] = [];
    const step = 256 / 32;
    for (let i = 0; i < 256; i += step) {
      const idx = Math.floor(i);
      const val = data[idx] || 0;
      const x = (idx / 255) * 100;
      const y = 30 - Math.min(28, (val / maxCount) * 28);
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return `M 0,30 L ${points.join(' L ')} L 100,30 Z`;
  };

  return (
    <div className="relative w-full aspect-[4/5] max-h-[55vh] rounded-xl overflow-hidden bg-surface-container-lowest shadow-md flex items-center justify-center border border-outline-variant select-none group">
      {/* Container for Zoom / Pan */}
      <div
        className="w-full h-full flex items-center justify-center transition-transform duration-200"
        style={{
          transform: `scale(${zoomLevel})`,
        }}
      >
        {/* Render Canvas */}
        <canvas
          ref={canvasRef}
          className={`max-w-full max-h-full object-contain shadow-xs transition-opacity duration-150 ${
            isComparing ? 'opacity-0' : 'opacity-100'
          }`}
        />

        {/* Hold-to-compare Original Image Overlay */}
        {originalImageSrc && (
          <img
            src={originalImageSrc}
            alt="Original unprocessed RAW"
            className={`absolute max-w-full max-h-full object-contain pointer-events-none transition-opacity duration-150 ${
              isComparing ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </div>

      {/* Comparison Badge */}
      {isComparing && (
        <div className="absolute top-3 left-3 bg-surface-container-lowest/90 backdrop-blur-md px-2.5 py-1 rounded text-primary font-mono text-[10px] font-bold tracking-wider border border-outline-variant shadow-sm z-20">
          ORIGINAL RAW
        </div>
      )}

      {/* Floating Top HUD: Live Mini Histogram & Clipping Indicators */}
      <div className="absolute top-2.5 right-2.5 bg-surface-container-lowest/90 backdrop-blur-md p-1.5 rounded-lg flex flex-col gap-1 shadow-md border border-outline-variant z-20 pointer-events-auto">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[9px] font-mono font-semibold tracking-wider text-on-surface-variant">
            HISTOGRAM
          </span>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" title="Shadow clipping safe" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Highlights active" />
          </div>
        </div>

        {/* SVG Mini Histogram Chart */}
        <svg className="w-24 h-7 text-primary overflow-visible" fill="none" viewBox="0 0 100 30">
          {histogram && (
            <>
              {/* Luminance fill */}
              <path
                d={getHistogramPath(histogram.l, histogram.maxCount)}
                fill="currentColor"
                fillOpacity="0.18"
              />
              {/* Luminance main stroke */}
              <path
                d={getHistogramPath(histogram.l, histogram.maxCount)}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Secondary ghost channels */}
              <path
                d={getHistogramPath(histogram.r, histogram.maxCount)}
                stroke="#e42b27"
                strokeWidth="1"
                strokeOpacity="0.5"
                fill="none"
              />
              <path
                d={getHistogramPath(histogram.b, histogram.maxCount)}
                stroke="#006481"
                strokeWidth="1"
                strokeOpacity="0.5"
                fill="none"
              />
            </>
          )}
        </svg>

        <div className="flex justify-between items-center text-[9px] text-on-surface-variant font-mono px-0.5">
          <span>0</span>
          <span className="text-primary font-semibold">
            EV {currentEV >= 0 ? `+${currentEV.toFixed(2)}` : currentEV.toFixed(2)}
          </span>
          <span>255</span>
        </div>
      </div>

      {/* Rule-of-Thirds Grid Overlay */}
      {showGrid && (
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-10">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-primary/20 bg-primary/5" />
          ))}
        </div>
      )}

      {/* Floating Canvas Quick-Adjust Capsule Dock */}
      <div className="absolute bottom-3 inset-x-0 mx-auto w-fit bg-surface-container-lowest/90 backdrop-blur-xl px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 z-20 border border-outline-variant">
        {/* Aspect Ratio Badge */}
        <div
          className="h-7 px-2 rounded-full text-on-surface-variant flex items-center gap-1 font-mono text-[11px]"
          title="Current Aspect Ratio"
        >
          <span className="material-symbols-outlined text-[15px]">crop_rotate</span>
          <span>{activeAspect}</span>
        </div>

        <div className="w-px h-3.5 bg-outline-variant" />

        {/* Magic Auto Tone Button */}
        <button
          onClick={handleMagicAutoTone}
          className={`w-7 h-7 rounded-full text-primary hover:bg-primary/10 flex items-center justify-center active:scale-90 transition-all ${
            wandAnimating ? 'scale-125' : ''
          }`}
          title="Magic Auto Tone (One-Tap Balance)"
        >
          <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
        </button>

        {/* Grid Guide Toggle */}
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-all ${
            showGrid
              ? 'text-white bg-primary'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
          }`}
          title="Toggle Rule-of-Thirds Grid"
        >
          <span className="material-symbols-outlined text-[16px]">grid_goldenratio</span>
        </button>

        {/* Color Lab Quick Shortcut */}
        <button
          onClick={onOpenColorLab}
          className="w-7 h-7 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-high flex items-center justify-center relative active:scale-90 transition-all"
          title="Open Color Lab & Palette"
        >
          <span className="material-symbols-outlined text-[16px]">palette</span>
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_4px_rgba(191,4,17,0.6)]" />
        </button>
      </div>
    </div>
  );
};
