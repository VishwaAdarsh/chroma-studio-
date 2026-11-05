import React from 'react';
import type { GeometryState } from '../../types/editor';

interface CropPanelProps {
  geometry: GeometryState;
  onChange: (geometry: GeometryState) => void;
  onReset: () => void;
  sourceDimensions?: { width: number; height: number };
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export const CropPanel: React.FC<CropPanelProps> = ({
  geometry,
  onChange,
  onReset,
  sourceDimensions = { width: 1920, height: 1080 },
  onInteractionStart,
  onInteractionEnd,
}) => {
  const aspectRatios = [
    { id: 'free', label: 'Free' },
    { id: '1:1', label: '1:1', ratio: 1 },
    { id: '4:5', label: '4:5', ratio: 4 / 5 },
    { id: '16:9', label: '16:9', ratio: 16 / 9 },
    { id: '9:16', label: '9:16', ratio: 9 / 16 },
    { id: '3:2', label: '3:2', ratio: 3 / 2 },
    { id: '4:3', label: '4:3', ratio: 4 / 3 },
  ];

  const handleAspectSelect = (aspectId: string) => {
    onInteractionStart?.();
    if (aspectId === 'free') {
      onChange({
        ...geometry,
        crop: {
          ...geometry.crop,
          aspectRatio: 'free',
        },
      });
      onInteractionEnd?.();
      return;
    }

    const cfg = aspectRatios.find((a) => a.id === aspectId);
    if (!cfg || !cfg.ratio) return;

    const targetRatio = cfg.ratio;
    const srcW = Math.max(1, sourceDimensions.width);
    const srcH = Math.max(1, sourceDimensions.height);
    const srcRatio = srcW / srcH;

    // Calculate normalized dimensions (w, h) in [0, 1] relative to source
    // Such that (w * srcW) / (h * srcH) === targetRatio
    let normW = 1;
    let normH = 1;

    const scale = targetRatio / srcRatio;
    if (scale <= 1) {
      normW = Math.max(0.05, scale);
      normH = 1;
    } else {
      normW = 1;
      normH = Math.max(0.05, 1 / scale);
    }

    const normX = Math.max(0, (1 - normW) / 2);
    const normY = Math.max(0, (1 - normH) / 2);

    onChange({
      ...geometry,
      crop: {
        x: normX,
        y: normY,
        width: normW,
        height: normH,
        aspectRatio: aspectId,
      },
    });
    onInteractionEnd?.();
  };

  const handleRotate90 = () => {
    onInteractionStart?.();
    onChange({
      ...geometry,
      rotation: (geometry.rotation + 90) % 360,
    });
    onInteractionEnd?.();
  };

  const handleFlipH = () => {
    onInteractionStart?.();
    onChange({
      ...geometry,
      flipH: !geometry.flipH,
    });
    onInteractionEnd?.();
  };

  const handleFlipV = () => {
    onInteractionStart?.();
    onChange({
      ...geometry,
      flipV: !geometry.flipV,
    });
    onInteractionEnd?.();
  };

  const handleResetOrientation = () => {
    onInteractionStart?.();
    onChange({
      ...geometry,
      rotation: 0,
      flipH: false,
      flipV: false,
    });
    onInteractionEnd?.();
  };

  // Normalized angle between -45° and +45° for slider
  const normalizedAngle = ((((geometry.rotation + 180) % 360) + 360) % 360) - 180;
  const clampedSliderAngle = Math.max(-45, Math.min(45, normalizedAngle));

  const handleStraightenChange = (angle: number) => {
    // Snap cleanly to 0° within ±0.4° to prevent accidental micro-tilting on touch screens
    const snappedAngle = Math.abs(angle) <= 0.4 ? 0 : angle;
    const baseRot = Math.round(geometry.rotation / 90) * 90;
    onChange({
      ...geometry,
      rotation: baseRot + snappedAngle,
    });
  };

  return (
    <div className="w-full bg-surface-container-low p-3 rounded-xl border border-outline-variant space-y-3 shadow-xs">
      {/* Aspect Ratio Selector Chips */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold uppercase text-on-surface-variant">
            Aspect Ratio
          </span>
          <button
            onClick={() => {
              onInteractionStart?.();
              onReset();
              onInteractionEnd?.();
            }}
            className="text-[10px] text-outline hover:text-primary flex items-center gap-0.5 cursor-pointer"
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
              className={`px-3 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap transition-all cursor-pointer ${
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
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2 pt-1 border-t border-outline-variant">
        <button
          onClick={handleRotate90}
          className="py-2 px-1 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex flex-col items-center gap-1 transition-all active:scale-95 border border-outline-variant shadow-xs cursor-pointer min-h-[44px]"
          title="Rotate 90 degrees clockwise"
        >
          <span className="material-symbols-outlined text-[17px] sm:text-[18px]">rotate_90_degrees_cw</span>
          <span className="text-[9px] sm:text-[10px] font-medium whitespace-nowrap">Rotate 90°</span>
        </button>

        <button
          onClick={handleFlipH}
          className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all active:scale-95 border shadow-xs cursor-pointer min-h-[44px] ${
            geometry.flipH
              ? 'bg-primary-container text-white border-primary'
              : 'bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border-outline-variant'
          }`}
          title="Flip Horizontally"
        >
          <span className="material-symbols-outlined text-[17px] sm:text-[18px]">flip</span>
          <span className="text-[9px] sm:text-[10px] font-medium whitespace-nowrap">Flip H</span>
        </button>

        <button
          onClick={handleFlipV}
          className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all active:scale-95 border shadow-xs cursor-pointer min-h-[44px] ${
            geometry.flipV
              ? 'bg-primary-container text-white border-primary'
              : 'bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border-outline-variant'
          }`}
          title="Flip Vertically"
        >
          <span className="material-symbols-outlined text-[17px] sm:text-[18px] rotate-90">flip</span>
          <span className="text-[9px] sm:text-[10px] font-medium whitespace-nowrap">Flip V</span>
        </button>

        <button
          onClick={handleResetOrientation}
          className="py-2 px-1 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex flex-col items-center gap-1 transition-all active:scale-95 border border-outline-variant shadow-xs cursor-pointer min-h-[44px]"
          title="Reset Orientation"
        >
          <span className="material-symbols-outlined text-[17px] sm:text-[18px]">restart_alt</span>
          <span className="text-[9px] sm:text-[10px] font-medium whitespace-nowrap">Reset</span>
        </button>
      </div>

      {/* Free Angle Straightening Scrubber with History & Auto-Crop Guarantee */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase text-[10px]">Straighten Angle</span>
            {Math.abs(clampedSliderAngle) > 0.05 && (
              <button
                onClick={() => {
                  onInteractionStart?.();
                  handleStraightenChange(0);
                  onInteractionEnd?.();
                }}
                className="px-2 py-0.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-primary font-mono text-[10px] font-bold border border-outline-variant transition-all active:scale-95 cursor-pointer min-h-[26px] flex items-center gap-1 shadow-xs"
                title="Snap level to 0°"
              >
                <span className="material-symbols-outlined text-[12px]">replay</span>
                <span>0°</span>
              </button>
            )}
          </div>
          <span className="font-mono text-primary font-bold">
            {clampedSliderAngle > 0 ? `+${clampedSliderAngle.toFixed(1)}°` : `${clampedSliderAngle.toFixed(1)}°`}
          </span>
        </div>
        <input
          type="range"
          min="-45"
          max="45"
          step="0.5"
          value={clampedSliderAngle}
          onPointerDown={() => onInteractionStart?.()}
          onPointerUp={() => onInteractionEnd?.()}
          onTouchStart={() => onInteractionStart?.()}
          onTouchEnd={() => onInteractionEnd?.()}
          onChange={(e) => handleStraightenChange(parseFloat(e.target.value))}
          onDoubleClick={() => {
            onInteractionStart?.();
            handleStraightenChange(0);
            onInteractionEnd?.();
          }}
          className="w-full h-1.5 bg-surface-container-high rounded-full accent-primary cursor-pointer"
        />
      </div>
    </div>
  );
};
