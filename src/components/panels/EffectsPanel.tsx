import React, { useState } from 'react';
import type { AdjustmentParameters } from '../../types/editor';
import { Scrubber } from '../Scrubber';

interface EffectsPanelProps {
  adjustments: AdjustmentParameters;
  onChange: (param: keyof AdjustmentParameters, value: number) => void;
  onResetParam: (param: keyof AdjustmentParameters) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

type EffectParam = 'clarity' | 'sharpen' | 'blur' | 'vignette' | 'grain' | 'fade';

export const EffectsPanel: React.FC<EffectsPanelProps> = ({
  adjustments,
  onChange,
  onResetParam,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const [activeParam, setActiveParam] = useState<EffectParam>('vignette');

  const effectConfigs: Record<
    EffectParam,
    { label: string; min: number; max: number; step: number; unit?: string }
  > = {
    vignette: { label: 'Vignette Darkening', min: 0, max: 100, step: 1, unit: '%' },
    grain: { label: '35mm Film Grain', min: 0, max: 100, step: 1, unit: '%' },
    fade: { label: 'Matte Black Fade', min: 0, max: 100, step: 1, unit: '%' },
    clarity: { label: 'Midtone Clarity', min: -100, max: 100, step: 1, unit: '%' },
    sharpen: { label: 'Edge Sharpening', min: 0, max: 100, step: 1, unit: '%' },
    blur: { label: 'Gaussian Soft Blur', min: 0, max: 100, step: 1, unit: '%' },
  };

  const currentConfig = effectConfigs[activeParam];

  return (
    <div className="w-full flex flex-col gap-2">
      <Scrubber
        label={currentConfig.label}
        value={adjustments[activeParam]}
        min={currentConfig.min}
        max={currentConfig.max}
        step={currentConfig.step}
        unit={currentConfig.unit}
        onChange={(val) => onChange(activeParam, val)}
        onReset={() => onResetParam(activeParam)}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
      />

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        {(Object.keys(effectConfigs) as EffectParam[]).map((param) => {
          const cfg = effectConfigs[param];
          const isSelected = activeParam === param;
          const hasVal = Math.abs(adjustments[param]) > 0.001;

          return (
            <button
              key={param}
              onClick={() => setActiveParam(param)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1 active:scale-95 ${
                isSelected
                  ? 'bg-primary-container text-white font-semibold shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface border border-outline-variant'
              }`}
            >
              <span>{cfg.label.split(' ')[0]}</span>
              {hasVal && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-primary'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
