import React, { useRef, useState } from 'react';
import type { ColorWheelAdjustment, ColorWheels } from '../types/editor';

interface ColorWheelsEditorProps {
  wheels: ColorWheels;
  onChange: (wheels: ColorWheels) => void;
  onReset: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

type WheelZone = 'shadows' | 'midtones' | 'highlights';

export const ColorWheelsEditor: React.FC<ColorWheelsEditorProps> = ({
  wheels,
  onChange,
  onReset,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const [activeZone, setActiveZone] = useState<WheelZone>('shadows');
  const isDraggingRef = useRef(false);
  const wheelRef = useRef<HTMLDivElement | null>(null);

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
  const satRatio = (current.saturation || 0) / 100;
  const angleRad = ((current.hue || 0) * Math.PI) / 180;
  const dotX = 60 + radius * satRatio * Math.cos(angleRad);
  const dotY = 60 + radius * satRatio * Math.sin(angleRad);

  const handlePointerCoord = (clientX: number, clientY: number) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const x = clientX - rect.left - 60;
    const y = clientY - rect.top - 60;
    const dist = Math.sqrt(x * x + y * y);
    const clampedDist = Math.min(radius, dist);
    const sat = Math.round((clampedDist / radius) * 100);
    let angle = Math.round((Math.atan2(y, x) * 180) / Math.PI);
    if (angle < 0) angle += 360;

    updateCurrent({ hue: angle, saturation: sat });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onInteractionStart?.();
    handlePointerCoord(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    handlePointerCoord(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore if already released
      }
      onInteractionEnd?.();
    }
  };

  const lumValue = current.luminance || 0;
  const lumPercentage = ((lumValue - (-100)) / (100 - (-100))) * 100;
  const lumZeroPercent = 50;
  const lumLeft = Math.min(lumPercentage, lumZeroPercent);
  const lumRight = Math.max(lumPercentage, lumZeroPercent);

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
          className="text-[10px] text-outline hover:text-primary flex items-center gap-0.5 px-2 py-1 rounded bg-surface-container-high border border-outline-variant font-semibold cursor-pointer"
        >
          <span className="material-symbols-outlined text-[13px]">refresh</span>
          <span>RESET WHEELS</span>
        </button>
      </div>

      {/* Interactive Radial Color Wheel with Continuous Pointer Dragging */}
      <div className="flex flex-col items-center justify-center py-2">
        <div
          ref={wheelRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative w-[120px] h-[120px] rounded-full cursor-crosshair shadow-md border-2 border-white ring-1 ring-outline-variant select-none touch-none"
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
            className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-md pointer-events-none transition-transform active:scale-125"
            style={{ left: `${dotX}px`, top: `${dotY}px` }}
          />
        </div>

        {/* Hue & Saturation Readout */}
        <div className="flex items-center gap-4 mt-3 text-[11px] font-mono text-on-surface">
          <span>Hue: <strong className="text-primary">{current.hue}°</strong></span>
          <span>Saturation: <strong className="text-primary">{current.saturation}%</strong></span>
        </div>
      </div>

      {/* Zone Luminance Slider */}
      <div className="bg-surface-container-lowest p-2.5 rounded-lg border border-outline-variant space-y-1.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              {activeZone} Luminance
            </span>
            {Math.abs(lumValue) > 0.01 && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </div>
          <div className="flex items-center gap-2">
            {Math.abs(lumValue) > 0.01 && (
              <button
                onClick={() => {
                  onInteractionStart?.();
                  updateCurrent({ luminance: 0 });
                  onInteractionEnd?.();
                }}
                className="text-[9px] text-outline hover:text-primary flex items-center gap-0.5"
                title="Reset luminance"
              >
                <span className="material-symbols-outlined text-[11px]">refresh</span>
                <span>0</span>
              </button>
            )}
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-surface-container-high text-primary tabular-nums">
              {lumValue > 0 ? `+${lumValue}` : lumValue}
            </span>
          </div>
        </div>

        <div className="relative w-full h-6 flex items-center">
          <div
            className="absolute top-1 bottom-1 w-0.5 bg-outline rounded-full pointer-events-none z-0 opacity-70"
            style={{ left: '50%', transform: 'translateX(-50%)' }}
          />
          <input
            type="range"
            min={-100}
            max={100}
            step={1}
            value={lumValue}
            onPointerDown={() => onInteractionStart?.()}
            onPointerUp={() => onInteractionEnd?.()}
            onTouchStart={() => onInteractionStart?.()}
            onTouchEnd={() => onInteractionEnd?.()}
            onChange={(e) => updateCurrent({ luminance: parseInt(e.target.value, 10) })}
            onDoubleClick={() => {
              onInteractionStart?.();
              updateCurrent({ luminance: 0 });
              onInteractionEnd?.();
            }}
            className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer focus:outline-none z-10"
            style={{
              background: `linear-gradient(to right, #ffe2de 0%, #ffe2de ${lumLeft}%, #bf0411 ${lumLeft}%, #e42b27 ${lumRight}%, #ffe2de ${lumRight}%, #ffe2de 100%)`,
            }}
          />
        </div>
      </div>

      {/* Preset Split Tone Quick Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => {
            onInteractionStart?.();
            updateCurrent({ hue: 200, saturation: 40 });
            onInteractionEnd?.();
          }}
          className="py-1 px-2 rounded bg-surface-container-lowest border border-outline-variant text-[10px] text-on-surface hover:border-primary shadow-xs cursor-pointer"
        >
          Teal Cyan (200°)
        </button>
        <button
          onClick={() => {
            onInteractionStart?.();
            updateCurrent({ hue: 15, saturation: 45 });
            onInteractionEnd?.();
          }}
          className="py-1 px-2 rounded bg-surface-container-lowest border border-outline-variant text-[10px] text-on-surface hover:border-primary shadow-xs cursor-pointer"
        >
          Crimson (15°)
        </button>
        <button
          onClick={() => {
            onInteractionStart?.();
            updateCurrent({ hue: 42, saturation: 40 });
            onInteractionEnd?.();
          }}
          className="py-1 px-2 rounded bg-surface-container-lowest border border-outline-variant text-[10px] text-on-surface hover:border-primary shadow-xs cursor-pointer"
        >
          Warm Amber (42°)
        </button>
      </div>
    </div>
  );
};
