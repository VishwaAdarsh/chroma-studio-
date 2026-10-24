import React from 'react';
import type { GeometryState } from '../../types/editor';

interface CropPanelProps {
  geometry: GeometryState;
  onChange: (geometry: GeometryState) => void;
  onReset: () => void;
}

export const CropPanel: React.FC<CropPanelProps> = ({
  geometry,
  onChange,
  onReset,
}) => {
  const aspectRatios = [
    { id: 'free', label: 'Free' },
    { id: '1:1', label: '1:1' },
    { id: '4:5', label: '4:5' },
    { id: '16:9', label: '16:9' },
    { id: '9:16', label: '9:16' },
    { id: '3:2', label: '3:2' },
    { id: '4:3', label: '4:3' },
  ];

  const handleAspectSelect = (aspectId: string) => {
    let width = 1;
    let height = 1;

    if (aspectId === '1:1') {
      width = 1;
      height = 1;
    } else if (aspectId === '4:5') {
      width = 0.8;
      height = 1;
    } else if (aspectId === '16:9') {
      width = 1;
      height = 9 / 16;
    } else if (aspectId === '9:16') {
      width = 9 / 16;
      height = 1;
    } else if (aspectId === '3:2') {
      width = 1;
      height = 2 / 3;
    } else if (aspectId === '4:3') {
      width = 1;
      height = 3 / 4;
    }

    const x = Math.max(0, (1 - width) / 2);
    const y = Math.max(0, (1 - height) / 2);

    onChange({
      ...geometry,
      crop: {
        x,
        y,
        width,
        height,
        aspectRatio: aspectId,
      },
    });
  };

  const handleRotate90 = () => {
    onChange({
      ...geometry,
      rotation: (geometry.rotation + 90) % 360,
    });
  };

  const handleFlipH = () => {
    onChange({
      ...geometry,
      flipH: !geometry.flipH,
    });
  };

  const handleFlipV = () => {
    onChange({
      ...geometry,
      flipV: !geometry.flipV,
    });
  };

  return (
    <div className="w-full bg-surface-container-low p-3 rounded-xl border border-outline-variant space-y-3 shadow-xs">
      {/* Aspect Ratio Selector Chips */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold uppercase text-on-surface-variant">Aspect Ratio</span>
          <button
            onClick={onReset}
            className="text-[10px] text-outline hover:text-primary flex items-center gap-0.5"
          >
            <span className="material-symbols-outlined text-[13px]">refresh</span>
            <span>RESET CROP</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {aspectRatios.map((item) => (
            <button
              key={item.id}
              onClick={() => handleAspectSelect(item.id)}
              className={`px-3 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap transition-all ${
                geometry.crop.aspectRatio === item.id
                  ? 'bg-primary-container text-white font-semibold shadow-xs'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rotation & Flip Controls */}
      <div className="grid grid-cols-4 gap-2 pt-1 border-t border-outline-variant">
        <button
          onClick={handleRotate90}
          className="py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex flex-col items-center gap-1 transition-all active:scale-95 border border-outline-variant shadow-xs"
          title="Rotate 90 degrees"
        >
          <span className="material-symbols-outlined text-[18px]">rotate_90_degrees_cw</span>
          <span className="text-[10px]">Rotate 90°</span>
        </button>

        <button
          onClick={handleFlipH}
          className={`py-2 rounded-xl flex flex-col items-center gap-1 transition-all active:scale-95 border shadow-xs ${
            geometry.flipH
              ? 'bg-primary-container text-white border-primary'
              : 'bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border-outline-variant'
          }`}
          title="Flip Horizontally"
        >
          <span className="material-symbols-outlined text-[18px]">flip</span>
          <span className="text-[10px]">Flip H</span>
        </button>

        <button
          onClick={handleFlipV}
          className={`py-2 rounded-xl flex flex-col items-center gap-1 transition-all active:scale-95 border shadow-xs ${
            geometry.flipV
              ? 'bg-primary-container text-white border-primary'
              : 'bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border-outline-variant'
          }`}
          title="Flip Vertically"
        >
          <span className="material-symbols-outlined text-[18px] rotate-90">flip</span>
          <span className="text-[10px]">Flip V</span>
        </button>

        <button
          onClick={() => onChange({ ...geometry, rotation: 0, flipH: false, flipV: false })}
          className="py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex flex-col items-center gap-1 transition-all active:scale-95 border border-outline-variant shadow-xs"
          title="Reset Orientation"
        >
          <span className="material-symbols-outlined text-[18px]">restart_alt</span>
          <span className="text-[10px]">Reset</span>
        </button>
      </div>

      {/* Free Angle Straightening Scrubber */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
          <span className="font-semibold uppercase text-[10px]">Straighten Angle</span>
          <span className="font-mono text-primary font-bold">{geometry.rotation}°</span>
        </div>
        <input
          type="range"
          min="-45"
          max="45"
          step="1"
          value={((geometry.rotation + 180) % 360) - 180}
          onChange={(e) =>
            onChange({
              ...geometry,
              rotation: parseInt(e.target.value, 10),
            })
          }
          className="w-full h-1.5 bg-surface-container-high rounded-full accent-primary"
        />
      </div>
    </div>
  );
};
