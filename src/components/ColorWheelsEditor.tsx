import React, { useState } from 'react';
import type { ColorWheelAdjustment, ColorWheels } from '../types/editor';

interface ColorWheelsEditorProps {
  wheels: ColorWheels;
  onChange: (wheels: ColorWheels) => void;
  onReset: () => void;
}

type WheelZone = 'shadows' | 'midtones' | 'highlights';

export const ColorWheelsEditor: React.FC<ColorWheelsEditorProps> = ({
  wheels,
  onChange,
  onReset,
}) => {
  const [activeZone, setActiveZone] = useState<WheelZone>('shadows');

  const current = wheels[activeZone];

  const updateCurrent = (partial: Partial<ColorWheelAdjustment>) => {
    onChange({
      ...wheels,
      [activeZone]: {
        ...current,
        ...partial,
      },
    });
  };

  // Convert hue and saturation into 2D polar coordinate offset
  const radius = 54; // wheel radius in pixels
  const satRatio = current.saturation / 100;
  const angleRad = (current.hue * Math.PI) / 180;
  const dotX = 60 + radius * satRatio * Math.cos(angleRad);
  const dotY = 60 + radius * satRatio * Math.sin(angleRad);

  const handleWheelClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - 60;
    const y = e.clientY - rect.top - 60;
    const dist = Math.sqrt(x * x + y * y);
    const clampedDist = Math.min(radius, dist);
    const sat = Math.round((clampedDist / radius) * 100);
    let angle = Math.round((Math.atan2(y, x) * 180) / Math.PI);
    if (angle < 0) angle += 360;

    updateCurrent({ hue: angle, saturation: sat });
  };

  return (
    <div className="w-full bg-surface-container-low p-3 rounded-xl border border-outline-variant space-y-3 shadow-xs">
      {/* Zone Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-surface-container-lowest rounded-lg border border-outline-variant shadow-xs">
          {(['shadows', 'midtones', 'highlights'] as WheelZone[]).map((zone) => (
            <button
              key={zone}
              onClick={() => setActiveZone(zone)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all ${
                activeZone === zone
                  ? 'bg-surface-container-high text-primary shadow-xs font-bold'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              {zone}
            </button>
          ))}
        </div>
        <button
          onClick={onReset}
          className="text-[10px] text-outline hover:text-primary flex items-center gap-0.5 px-2 py-1 rounded bg-surface-container-high border border-outline-variant font-semibold"
        >
          <span className="material-symbols-outlined text-[13px]">refresh</span>
          <span>RESET WHEELS</span>
        </button>
      </div>

      {/* Interactive Radial Color Wheel */}
      <div className="flex flex-col items-center justify-center py-2">
        <div
          onClick={handleWheelClick}
          className="relative w-[120px] h-[120px] rounded-full cursor-crosshair shadow-md border-2 border-white ring-1 ring-outline-variant"
          style={{
            background:
              'radial-gradient(circle closest-side, white 0%, transparent 100%), conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
          }}
        >
          {/* Center Neutral Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-2.5 h-2.5 rounded-full border border-black/30" />
          </div>

          {/* Draggable Active Hue/Sat Point */}
          <div
            className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-md pointer-events-none"
            style={{ left: `${dotX}px`, top: `${dotY}px` }}
          />
        </div>

        {/* Readout */}
        <div className="flex items-center gap-4 mt-3 text-[11px] font-mono text-on-surface">
          <span>Hue: <strong className="text-primary">{current.hue}°</strong></span>
          <span>Saturation: <strong className="text-primary">{current.saturation}%</strong></span>
        </div>
      </div>

      {/* Preset Split Tone Quick Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => updateCurrent({ hue: 200, saturation: 40 })}
          className="py-1 px-2 rounded bg-surface-container-lowest border border-outline-variant text-[10px] text-on-surface hover:border-primary shadow-xs"
        >
          Teal Cyan (200°)
        </button>
        <button
          onClick={() => updateCurrent({ hue: 15, saturation: 45 })}
          className="py-1 px-2 rounded bg-surface-container-lowest border border-outline-variant text-[10px] text-on-surface hover:border-primary shadow-xs"
        >
          Crimson (15°)
        </button>
        <button
          onClick={() => updateCurrent({ hue: 42, saturation: 40 })}
          className="py-1 px-2 rounded bg-surface-container-lowest border border-outline-variant text-[10px] text-on-surface hover:border-primary shadow-xs"
        >
          Warm Amber (42°)
        </button>
      </div>
    </div>
  );
};
