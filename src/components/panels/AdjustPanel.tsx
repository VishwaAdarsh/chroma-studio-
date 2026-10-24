import React, { useState } from 'react';
import type { AdjustmentParameters } from '../../types/editor';
import { Scrubber } from '../Scrubber';

interface AdjustPanelProps {
  adjustments: AdjustmentParameters;
  onChange: (param: keyof AdjustmentParameters, value: number) => void;
  onResetParam: (param: keyof AdjustmentParameters) => void;
  onResetGroup: (group: 'tone' | 'color') => void;
}

type AdjustParam =
  | 'exposure'
  | 'brightness'
  | 'contrast'
  | 'highlights'
  | 'shadows'
  | 'whites'
  | 'blacks'
  | 'temperature'
  | 'tint'
  | 'saturation'
  | 'vibrance';

export const AdjustPanel: React.FC<AdjustPanelProps> = ({
  adjustments,
  onChange,
  onResetParam,
  onResetGroup: _onResetGroup,
}) => {
  const [activeParam, setActiveParam] = useState<AdjustParam>('exposure');

  const paramConfigs: Record<
    AdjustParam,
    { label: string; min: number; max: number; step: number; unit?: string; group: 'tone' | 'color' }
  > = {
    exposure: { label: 'Exposure', min: -2.0, max: 2.0, step: 0.05, unit: ' EV', group: 'tone' },
    brightness: { label: 'Brightness', min: -100, max: 100, step: 1, group: 'tone' },
    contrast: { label: 'Contrast', min: -100, max: 100, step: 1, group: 'tone' },
    highlights: { label: 'Highlights', min: -100, max: 100, step: 1, group: 'tone' },
    shadows: { label: 'Shadows', min: -100, max: 100, step: 1, group: 'tone' },
    whites: { label: 'Whites', min: -100, max: 100, step: 1, group: 'tone' },
    blacks: { label: 'Blacks', min: -100, max: 100, step: 1, group: 'tone' },
    temperature: { label: 'Temperature (Kelvin)', min: -100, max: 100, step: 1, group: 'color' },
    tint: { label: 'Tint (Green / Magenta)', min: -100, max: 100, step: 1, group: 'color' },
    saturation: { label: 'Saturation', min: -100, max: 100, step: 1, group: 'color' },
    vibrance: { label: 'Vibrance', min: -100, max: 100, step: 1, group: 'color' },
  };

  const currentConfig = paramConfigs[activeParam];

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Active Parameter Scrubber */}
      <Scrubber
        label={currentConfig.label}
        value={adjustments[activeParam]}
        min={currentConfig.min}
        max={currentConfig.max}
        step={currentConfig.step}
        unit={currentConfig.unit}
        onChange={(val) => onChange(activeParam, val)}
        onReset={() => onResetParam(activeParam)}
      />

      {/* Parameter Switcher Pill Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        {(Object.keys(paramConfigs) as AdjustParam[]).map((param) => {
          const cfg = paramConfigs[param];
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
