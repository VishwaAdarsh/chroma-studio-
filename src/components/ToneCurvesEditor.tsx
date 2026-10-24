import React, { useState } from 'react';
import type { CurvePoint, ToneCurves } from '../types/editor';

interface ToneCurvesEditorProps {
  curves: ToneCurves;
  onChange: (curves: ToneCurves) => void;
  onReset: () => void;
}

type Channel = 'rgb' | 'red' | 'green' | 'blue';

export const ToneCurvesEditor: React.FC<ToneCurvesEditorProps> = ({
  curves,
  onChange,
  onReset,
}) => {
  const [activeChannel, setActiveChannel] = useState<Channel>('rgb');

  const currentPoints = curves[activeChannel];

  const getPathData = (pts: CurvePoint[]) => {
    if (pts.length < 2) return '';
    const scale = (val: number) => (val / 255) * 160;
    const sorted = [...pts].sort((a, b) => a.x - b.x);
    let d = `M ${scale(sorted[0].x)} ${160 - scale(sorted[0].y)}`;
    for (let i = 1; i < sorted.length; i++) {
      d += ` L ${scale(sorted[i].x)} ${160 - scale(sorted[i].y)}`;
    }
    return d;
  };

  const channelColors: Record<Channel, string> = {
    rgb: '#bf0411',
    red: '#e42b27',
    green: '#006481',
    blue: '#a7382e',
  };

  return (
    <div className="w-full bg-surface-container-low p-3 rounded-xl border border-outline-variant space-y-3 shadow-xs">
      {/* Channel Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-surface-container-lowest rounded-lg border border-outline-variant shadow-xs">
          {(['rgb', 'red', 'green', 'blue'] as Channel[]).map((ch) => (
            <button
              key={ch}
              onClick={() => setActiveChannel(ch)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all ${
                activeChannel === ch
                  ? 'bg-surface-container-high text-on-surface shadow-xs font-bold'
                  : 'text-outline hover:text-on-surface'
              }`}
              style={{
                color: activeChannel === ch ? channelColors[ch] : undefined,
              }}
            >
              {ch}
            </button>
          ))}
        </div>
        <button
          onClick={onReset}
          className="text-[10px] text-outline hover:text-primary flex items-center gap-0.5 px-2 py-1 rounded bg-surface-container-high border border-outline-variant font-semibold"
        >
          <span className="material-symbols-outlined text-[13px]">refresh</span>
          <span>RESET CURVES</span>
        </button>
      </div>

      {/* SVG Curve Grid & Curve Line */}
      <div className="relative w-[160px] h-[160px] mx-auto bg-surface-container-lowest rounded-lg border border-outline-variant overflow-hidden shadow-inner">
        {/* Grid Lines */}
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="border-r border-b border-outline-variant/30" />
          ))}
        </div>

        {/* Diagonal Reference */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <line x1="0" y1="160" x2="160" y2="0" stroke="#e6bdb8" strokeDasharray="3,3" />
        </svg>

        {/* Active Curve */}
        <svg className="absolute inset-0 w-full h-full overflow-visible">
          <path
            d={getPathData(currentPoints)}
            fill="none"
            stroke={channelColors[activeChannel]}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>

        {/* Draggable Anchor Points */}
        {currentPoints.map((pt, idx) => {
          const posX = (pt.x / 255) * 160;
          const posY = 160 - (pt.y / 255) * 160;
          return (
            <div
              key={idx}
              className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md cursor-pointer hover:scale-125 transition-transform"
              style={{
                left: `${posX}px`,
                top: `${posY}px`,
                backgroundColor: channelColors[activeChannel],
              }}
              title={`Point ${idx + 1}: (${pt.x}, ${pt.y})`}
            />
          );
        })}
      </div>

      {/* Quick Curve Adjusters */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <button
          onClick={() => {
            // S-Curve (High Contrast)
            onChange({
              ...curves,
              [activeChannel]: [
                { x: 0, y: 0 },
                { x: 64, y: 45 },
                { x: 192, y: 215 },
                { x: 255, y: 255 },
              ],
            });
          }}
          className="py-1.5 px-2 rounded-lg bg-surface-container-lowest text-[11px] font-medium text-on-surface hover:border-primary border border-outline-variant transition-all text-center shadow-xs"
        >
          High Contrast
        </button>
        <button
          onClick={() => {
            // Lifted Blacks (Matte Film)
            onChange({
              ...curves,
              [activeChannel]: [
                { x: 0, y: 35 },
                { x: 128, y: 128 },
                { x: 255, y: 240 },
              ],
            });
          }}
          className="py-1.5 px-2 rounded-lg bg-surface-container-lowest text-[11px] font-medium text-on-surface hover:border-primary border border-outline-variant transition-all text-center shadow-xs"
        >
          Matte Lift
        </button>
        <button
          onClick={() => {
            // Linear Reset
            onChange({
              ...curves,
              [activeChannel]: [
                { x: 0, y: 0 },
                { x: 255, y: 255 },
              ],
            });
          }}
          className="py-1.5 px-2 rounded-lg bg-surface-container-lowest text-[11px] font-medium text-on-surface hover:border-primary border border-outline-variant transition-all text-center shadow-xs"
        >
          Linear (Flat)
        </button>
      </div>
    </div>
  );
};
