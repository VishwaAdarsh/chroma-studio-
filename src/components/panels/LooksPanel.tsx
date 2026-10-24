import React, { useState } from 'react';
import { PRESET_CATEGORIES, PRESETS } from '../../data/presets';
import type { Preset } from '../../types/editor';

interface LooksPanelProps {
  activePresetId: string | null;
  presetIntensity: number;
  onSelectPreset: (preset: Preset | null) => void;
  onChangeIntensity: (intensity: number) => void;
  favorites: string[];
  onToggleFavorite: (presetId: string) => void;
}

export const LooksPanel: React.FC<LooksPanelProps> = ({
  activePresetId,
  presetIntensity,
  onSelectPreset,
  onChangeIntensity,
  favorites,
  onToggleFavorite,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const filteredPresets =
    selectedCategory === 'All'
      ? PRESETS
      : PRESETS.filter((p) => p.category === selectedCategory);

  const activePreset = PRESETS.find((p) => p.id === activePresetId);

  return (
    <div className="w-full flex flex-col gap-2.5">
      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {PRESET_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-primary-container text-white font-semibold shadow-xs'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface border border-outline-variant'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Preset Intensity Slider (when a preset is active) */}
      {activePreset && (
        <div className="bg-surface-container-low p-2 rounded-xl border border-outline-variant flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-1.5 min-w-[100px]">
            <span className="text-[10px] uppercase font-semibold text-on-surface-variant">Look Strength</span>
            <span className="text-[11px] font-mono font-bold text-primary">
              {presetIntensity}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={presetIntensity}
            onChange={(e) => onChangeIntensity(parseInt(e.target.value, 10))}
            className="flex-1 h-1.5 bg-surface-container-high rounded-full accent-primary"
          />
          <button
            onClick={() => onSelectPreset(null)}
            className="text-[10px] text-outline hover:text-primary px-2 py-0.5 rounded bg-surface-container-high font-semibold"
            title="Reset to Unfiltered Original"
          >
            CLEAR
          </button>
        </div>
      )}

      {/* Preset Cards Horizontal Strip */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {/* Normal / Unfiltered item */}
        <div
          onClick={() => onSelectPreset(null)}
          className="flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer group active:scale-95 transition-all"
        >
          <div
            className={`w-14 h-14 rounded-xl overflow-hidden bg-surface-container-low flex items-center justify-center border transition-all ${
              activePresetId === null
                ? 'border-primary shadow-xs bg-surface-container-lowest'
                : 'border-outline-variant group-hover:border-primary/50'
            }`}
          >
            <span className="material-symbols-outlined text-[20px] text-outline">blur_off</span>
          </div>
          <span
            className={`text-[10px] font-medium ${
              activePresetId === null ? 'text-primary font-bold' : 'text-on-surface-variant'
            }`}
          >
            Normal
          </span>
        </div>

        {/* Filtered Preset items */}
        {filteredPresets.map((preset) => {
          const isSelected = activePresetId === preset.id;
          const isFav = favorites.includes(preset.id);

          return (
            <div
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className="flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer group active:scale-95 transition-all"
            >
              <div
                className={`w-14 h-14 rounded-xl overflow-hidden relative shadow-xs transition-all ${
                  isSelected
                    ? 'border-2 border-primary shadow-md ring-2 ring-primary/20'
                    : 'border border-outline-variant group-hover:border-primary/50'
                }`}
              >
                {/* Simulated Preset Look Visual Swatch */}
                <div
                  className={`w-full h-full bg-gradient-to-br ${
                    preset.thumbnailGradient || 'from-red-500 to-amber-700'
                  }`}
                />

                {/* Selection Checkmark */}
                {isSelected && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-[16px] bg-primary rounded-full p-0.5 shadow-sm">
                      check
                    </span>
                  </div>
                )}

                {/* Favorite Heart indicator */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(preset.id);
                  }}
                  className="absolute top-1 right-1 p-0.5 rounded-full hover:bg-black/30 text-white/80 hover:text-white"
                >
                  <span
                    className="material-symbols-outlined text-[13px]"
                    style={{
                      color: isFav ? '#bf0411' : undefined,
                      fontVariationSettings: isFav ? "'FILL' 1" : "'FILL' 0",
                    }}
                  >
                    favorite
                  </span>
                </button>
              </div>

              <span
                className={`text-[10px] truncate max-w-[64px] text-center font-medium ${
                  isSelected ? 'text-primary font-bold' : 'text-on-surface-variant group-hover:text-on-surface'
                }`}
              >
                {preset.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
