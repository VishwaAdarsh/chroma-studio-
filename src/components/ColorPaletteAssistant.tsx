import React, { useState } from 'react';
import type { DominantColor } from '../types/editor';

interface ColorPaletteAssistantProps {
  dominantColors: DominantColor[];
  onSelectPresetRecommendation?: (presetId: string) => void;
}

export const ColorPaletteAssistant: React.FC<ColorPaletteAssistantProps> = ({
  dominantColors,
  onSelectPresetRecommendation,
}) => {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const copyToClipboard = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 1500);
  };

  // Calculate warm vs cool balance
  let warmSum = 0;
  let coolSum = 0;
  dominantColors.forEach((c) => {
    const [r, , b] = c.rgb;
    if (r > b) warmSum += c.percentage;
    else coolSum += c.percentage;
  });
  const total = warmSum + coolSum || 1;
  const warmPercent = Math.round((warmSum / total) * 100);
  const coolPercent = 100 - warmPercent;

  return (
    <div className="w-full bg-surface-container-low p-3 rounded-xl border border-outline-variant space-y-3 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-primary">palette</span>
          <span className="text-[12px] font-semibold uppercase tracking-wider text-on-surface">
            Color Palette Assistant
          </span>
        </div>
        <span className="text-[10px] text-outline font-mono">
          {dominantColors.length} Tones Extracted
        </span>
      </div>

      {/* Dominant Color Swatches */}
      <div className="grid grid-cols-6 gap-2">
        {dominantColors.map((color, idx) => (
          <div
            key={idx}
            onClick={() => copyToClipboard(color.hex)}
            className="flex flex-col items-center gap-1 cursor-pointer group active:scale-95 transition-all"
            title={`Click to copy ${color.hex}`}
          >
            <div
              className="w-full aspect-square rounded-lg shadow-xs border border-outline-variant group-hover:scale-105 transition-transform relative"
              style={{ backgroundColor: color.hex }}
            >
              {copiedHex === color.hex && (
                <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-[14px]">check</span>
                </div>
              )}
            </div>
            <span className="text-[9px] font-mono text-on-surface-variant uppercase truncate max-w-full font-semibold">
              {color.hex}
            </span>
            <span className="text-[8px] text-outline">{color.percentage}%</span>
          </div>
        ))}
      </div>

      {/* Warm vs Cool Meter */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-on-surface-variant font-medium">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Warm {warmPercent}%
          </span>
          <span className="flex items-center gap-1">
            Cool {coolPercent}%
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
          </span>
        </div>
        <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-400"
            style={{ width: `${warmPercent}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-sky-400 to-cyan-600"
            style={{ width: `${coolPercent}%` }}
          />
        </div>
      </div>

      {/* Recommended Presets based on analysis */}
      <div className="pt-1 border-t border-outline-variant">
        <span className="text-[10px] text-on-surface-variant block mb-1.5 font-semibold">
          Recommended Looks for this Palette:
        </span>
        <div className="flex items-center gap-2">
          {warmPercent > 50 ? (
            <>
              <button
                onClick={() => onSelectPresetRecommendation?.('cine-goldenhour')}
                className="px-2.5 py-1 rounded bg-surface-container-lowest text-[10px] text-primary hover:border-primary border border-outline-variant transition-colors shadow-xs font-medium"
              >
                Golden Hour Sun
              </button>
              <button
                onClick={() => onSelectPresetRecommendation?.('film-kodachrome')}
                className="px-2.5 py-1 rounded bg-surface-container-lowest text-[10px] text-primary hover:border-primary border border-outline-variant transition-colors shadow-xs font-medium"
              >
                Kodachrome 64
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onSelectPresetRecommendation?.('cine-bluehour')}
                className="px-2.5 py-1 rounded bg-surface-container-lowest text-[10px] text-primary hover:border-primary border border-outline-variant transition-colors shadow-xs font-medium"
              >
                Blue Hour Twilight
              </button>
              <button
                onClick={() => onSelectPresetRecommendation?.('cine-moody')}
                className="px-2.5 py-1 rounded bg-surface-container-lowest text-[10px] text-primary hover:border-primary border border-outline-variant transition-colors shadow-xs font-medium"
              >
                Moody Nordic
              </button>
            </>
          )}
          <button
            onClick={() => onSelectPresetRecommendation?.('cine-tealandorange')}
            className="px-2.5 py-1 rounded bg-surface-container-lowest text-[10px] text-primary hover:border-primary border border-outline-variant transition-colors shadow-xs font-medium"
          >
            Teal & Orange
          </button>
        </div>
      </div>
    </div>
  );
};
