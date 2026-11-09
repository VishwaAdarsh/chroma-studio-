import React, { useState, useEffect, useRef } from 'react';

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

export const Scrubber: React.FC<ScrubberProps> = React.memo(({
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
  // Local immediate value state for zero-latency 60fps thumb tracking & numeric readout
  const [localVal, setLocalVal] = useState<number>(value);
  const isInteractingRef = useRef<boolean>(false);

  // Synchronize local value when external value changes and user is not actively dragging
  useEffect(() => {
    if (!isInteractingRef.current) {
      setLocalVal(value);
    }
  }, [value]);

  const percentage = ((localVal - min) / (max - min)) * 100;
  const zeroPercent = ((0 - min) / (max - min)) * 100;

  const left = Math.min(percentage, zeroPercent);
  const right = Math.max(percentage, zeroPercent);

  const displayVal =
    localVal > 0
      ? `+${localVal.toFixed(step < 1 ? 2 : 0)}${unit}`
      : `${localVal.toFixed(step < 1 ? 2 : 0)}${unit}`;

  const hasChanged = Math.abs(localVal) > 0.001;

  const handleStart = () => {
    isInteractingRef.current = true;
    onInteractionStart?.();
  };

  const handleEnd = () => {
    isInteractingRef.current = false;
    onInteractionEnd?.();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
    const newVal = parseFloat((e.target as HTMLInputElement).value);
    if (!Number.isNaN(newVal)) {
      setLocalVal(newVal);
      onChange(newVal);
    }
  };

  const handleResetWithHistory = () => {
    isInteractingRef.current = false;
    setLocalVal(0);
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
              className="text-[9px] sm:text-[10px] text-outline hover:text-primary flex items-center gap-0.5 active:scale-95 transition-all cursor-pointer min-h-[32px] px-2 py-1 rounded touch-manipulation hover:bg-white/5"
              title="Reset to 0"
            >
              <span className="material-symbols-outlined text-[13px]">refresh</span>
              <span>RESET</span>
            </button>
          )}
          <span className="text-[10px] sm:text-[11px] font-mono font-semibold px-1.5 sm:px-2 py-0.5 rounded bg-surface-container-lowest text-primary border border-outline-variant tabular-nums shadow-xs">
            {displayVal}
          </span>
        </div>
      </div>

      {/* Tactile Scrubber Track */}
      <div className="relative w-full h-9 sm:h-8 flex items-center px-1 touch-none">
        {/* Center Zero Notch */}
        <div
          className="absolute top-1.5 bottom-1.5 w-0.5 bg-outline rounded-full pointer-events-none z-0 opacity-70"
          style={{ left: `${zeroPercent}%`, transform: 'translateX(-50%)' }}
        />

        {/* Range Input with Immediate Pointer Response */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localVal}
          onPointerDown={handleStart}
          onPointerUp={handleEnd}
          onTouchStart={handleStart}
          onTouchEnd={handleEnd}
          onKeyDown={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
              handleStart();
            }
          }}
          onKeyUp={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
              handleEnd();
            }
          }}
          onChange={handleInputChange}
          onInput={handleInputChange}
          onDoubleClick={handleResetWithHistory}
          className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer focus:outline-none z-10 select-none"
          style={{
            background: `linear-gradient(to right, #ffe2de 0%, #ffe2de ${left}%, #bf0411 ${left}%, #e42b27 ${right}%, #ffe2de ${right}%, #ffe2de 100%)`,
          }}
        />
      </div>
    </div>
  );
});
