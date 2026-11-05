import React from 'react';

interface ScrubberProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (val: number) => void;
  onReset: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export const Scrubber: React.FC<ScrubberProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
  onReset,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const percentage = ((value - min) / (max - min)) * 100;
  const zeroPercent = ((0 - min) / (max - min)) * 100;

  const left = Math.min(percentage, zeroPercent);
  const right = Math.max(percentage, zeroPercent);

  const displayVal =
    value > 0
      ? `+${value.toFixed(step < 1 ? 2 : 0)}${unit}`
      : `${value.toFixed(step < 1 ? 2 : 0)}${unit}`;

  const hasChanged = Math.abs(value) > 0.001;

  const handleResetWithHistory = () => {
    onInteractionStart?.();
    onReset();
    onInteractionEnd?.();
  };

  return (
    <div className="w-full bg-surface-container-low p-2.5 rounded-xl space-y-1.5 border border-outline-variant shadow-sm">
      {/* Label and Value Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant truncate">
            {label}
          </span>
          {hasChanged && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(191,4,17,0.6)] shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {hasChanged && (
            <button
              onClick={handleResetWithHistory}
              className="text-[9px] sm:text-[10px] text-outline hover:text-primary flex items-center gap-0.5 active:scale-95 transition-all cursor-pointer min-h-[30px] px-1.5 rounded hover:bg-white/5"
              title="Reset to 0"
            >
              <span className="material-symbols-outlined text-[12px]">refresh</span>
              <span>RESET</span>
            </button>
          )}
          <span className="text-[10px] sm:text-[11px] font-mono font-semibold px-1.5 sm:px-2 py-0.5 rounded bg-surface-container-lowest text-primary border border-outline-variant tabular-nums shadow-xs">
            {displayVal}
          </span>
        </div>
      </div>

      {/* Tactile Scrubber Track */}
      <div className="relative w-full h-8 flex items-center px-1 touch-none">
        {/* Center Zero Notch */}
        <div
          className="absolute top-1.5 bottom-1.5 w-0.5 bg-outline rounded-full pointer-events-none z-0 opacity-70"
          style={{ left: `${zeroPercent}%`, transform: 'translateX(-50%)' }}
        />

        {/* Range Input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onPointerDown={() => onInteractionStart?.()}
          onPointerUp={() => onInteractionEnd?.()}
          onTouchStart={() => onInteractionStart?.()}
          onTouchEnd={() => onInteractionEnd?.()}
          onKeyDown={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
              onInteractionStart?.();
            }
          }}
          onKeyUp={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
              onInteractionEnd?.();
            }
          }}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onDoubleClick={handleResetWithHistory}
          className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer focus:outline-none z-10 transition-all"
          style={{
            background: `linear-gradient(to right, #ffe2de 0%, #ffe2de ${left}%, #bf0411 ${left}%, #e42b27 ${right}%, #ffe2de ${right}%, #ffe2de 100%)`,
          }}
        />
      </div>
    </div>
  );
};
