import React, { useState } from 'react';
import type { HslAdjustments, HslChannel, HslChannelAdjustment } from '../types/editor';
import { Scrubber } from './Scrubber';

interface HslColorMixerProps {
  hsl: HslAdjustments;
  onChange: (hsl: HslAdjustments) => void;
  onResetChannel?: (channel: HslChannel) => void;
  onResetAll?: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

interface ChannelMeta {
  id: HslChannel;
  name: string;
  color: string;
  glow: string;
}

const CHANNELS: ChannelMeta[] = [
  { id: 'red', name: 'Red', color: '#EF4444', glow: 'rgba(239, 68, 68, 0.4)' },
  { id: 'orange', name: 'Orange', color: '#F97316', glow: 'rgba(249, 115, 22, 0.4)' },
  { id: 'yellow', name: 'Yellow', color: '#EAB308', glow: 'rgba(234, 179, 8, 0.4)' },
  { id: 'green', name: 'Green', color: '#22C55E', glow: 'rgba(34, 197, 94, 0.4)' },
  { id: 'aqua', name: 'Aqua', color: '#06B6D4', glow: 'rgba(6, 182, 212, 0.4)' },
  { id: 'blue', name: 'Blue', color: '#3B82F6', glow: 'rgba(59, 130, 246, 0.4)' },
  { id: 'purple', name: 'Purple', color: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.4)' },
  { id: 'magenta', name: 'Magenta', color: '#EC4899', glow: 'rgba(236, 72, 153, 0.4)' },
];

export const HslColorMixer: React.FC<HslColorMixerProps> = ({
  hsl,
  onChange,
  onResetChannel,
  onResetAll,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<HslChannel>('red');
  const [activeProperty, setActiveProperty] = useState<'hue' | 'saturation' | 'luminance'>('saturation');

  const channelData: HslChannelAdjustment = hsl[selectedChannel] || {
    hue: 0,
    saturation: 0,
    luminance: 0,
  };

  const currentMeta = CHANNELS.find((c) => c.id === selectedChannel)!;

  const handlePropertyChange = (property: 'hue' | 'saturation' | 'luminance', value: number) => {
    const updatedChannel: HslChannelAdjustment = {
      ...channelData,
      [property]: value,
    };
    onChange({
      ...hsl,
      [selectedChannel]: updatedChannel,
    });
  };

  const handleResetCurrent = () => {
    if (onResetChannel) {
      onResetChannel(selectedChannel);
    } else {
      onChange({
        ...hsl,
        [selectedChannel]: { hue: 0, saturation: 0, luminance: 0 },
      });
    }
  };

  const handleResetEverything = () => {
    if (onResetAll) {
      onResetAll();
    } else {
      const resetHsl: HslAdjustments = {
        red: { hue: 0, saturation: 0, luminance: 0 },
        orange: { hue: 0, saturation: 0, luminance: 0 },
        yellow: { hue: 0, saturation: 0, luminance: 0 },
        green: { hue: 0, saturation: 0, luminance: 0 },
        aqua: { hue: 0, saturation: 0, luminance: 0 },
        blue: { hue: 0, saturation: 0, luminance: 0 },
        purple: { hue: 0, saturation: 0, luminance: 0 },
        magenta: { hue: 0, saturation: 0, luminance: 0 },
      };
      onChange(resetHsl);
    }
  };

  // Check if any adjustments exist on any channel
  const hasAnyAdjustments = CHANNELS.some((ch) => {
    const adj = hsl[ch.id];
    return adj && (adj.hue !== 0 || adj.saturation !== 0 || adj.luminance !== 0);
  });

  const hasCurrentAdjustments =
    channelData.hue !== 0 || channelData.saturation !== 0 || channelData.luminance !== 0;

  return (
    <div className="w-full bg-[#0D1424] border border-white/10 rounded-2xl p-3.5 space-y-3 shadow-lg">
      {/* Header with Title and Reset Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[#8B5CF6]">palette</span>
          <span className="text-[12px] font-bold text-white tracking-wide">
            8-Channel HSL Mixer
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-[#94A3B8] font-mono">
            {currentMeta.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasCurrentAdjustments && (
            <button
              onClick={handleResetCurrent}
              className="text-[10px] text-[#94A3B8] hover:text-white flex items-center gap-0.5 transition-colors cursor-pointer py-1 px-1.5 rounded hover:bg-white/5"
              title={`Reset ${currentMeta.name} channel`}
            >
              <span className="material-symbols-outlined text-[13px]">refresh</span>
              <span>Reset {currentMeta.name}</span>
            </button>
          )}

          {hasAnyAdjustments && (
            <button
              onClick={handleResetEverything}
              className="text-[10px] text-pink-400 hover:text-pink-300 flex items-center gap-0.5 transition-colors cursor-pointer py-1 px-1.5 rounded hover:bg-pink-500/10"
              title="Reset all HSL channels"
            >
              <span>Reset All</span>
            </button>
          )}
        </div>
      </div>

      {/* 8 Channel Color Dot Selectors */}
      <div className="flex items-center justify-between overflow-x-auto no-scrollbar gap-0.5 sm:gap-1 px-1 py-1 bg-[#070B14]/70 rounded-xl border border-white/5">
        {CHANNELS.map((ch) => {
          const isSelected = selectedChannel === ch.id;
          const chData = hsl[ch.id];
          const isModified =
            chData && (chData.hue !== 0 || chData.saturation !== 0 || chData.luminance !== 0);

          return (
            <button
              key={ch.id}
              onClick={() => setSelectedChannel(ch.id)}
              className="relative p-1 sm:p-1.5 rounded-xl flex flex-col items-center gap-1 transition-all active:scale-95 group cursor-pointer min-w-[32px] sm:min-w-[36px]"
              title={`${ch.name} Channel`}
            >
              <div
                className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full transition-all flex items-center justify-center ${
                  isSelected ? 'scale-115 ring-2 ring-white shadow-md' : 'opacity-80 group-hover:opacity-100'
                }`}
                style={{
                  backgroundColor: ch.color,
                  boxShadow: isSelected ? `0 0 12px ${ch.glow}` : undefined,
                }}
              >
                {isModified && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                )}
              </div>
              <span
                className={`text-[8px] sm:text-[9px] font-medium transition-colors ${
                  isSelected ? 'text-white font-bold' : 'text-[#64748B]'
                }`}
              >
                {ch.name.slice(0, 3)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Property Selectors (Hue, Saturation, Luminance) */}
      <div className="grid grid-cols-3 gap-1 bg-[#070B14]/60 p-1 rounded-xl border border-white/5">
        {(['hue', 'saturation', 'luminance'] as const).map((prop) => {
          const isSelected = activeProperty === prop;
          const val = channelData[prop];
          const hasVal = val !== 0;

          return (
            <button
              key={prop}
              onClick={() => setActiveProperty(prop)}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#8B5CF6] text-white font-semibold shadow-xs'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="capitalize">{prop}</span>
              {hasVal && (
                <span className="text-[10px] font-mono opacity-90">
                  {val > 0 ? `+${val}` : val}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Scrubber for Active Property */}
      <div className="pt-1">
        <Scrubber
          label={`${currentMeta.name} ${activeProperty.charAt(0).toUpperCase() + activeProperty.slice(1)}`}
          value={channelData[activeProperty]}
          min={-100}
          max={100}
          step={1}
          unit={activeProperty === 'hue' ? '°' : '%'}
          onChange={(val) => handlePropertyChange(activeProperty, val)}
          onReset={() => handlePropertyChange(activeProperty, 0)}
          onInteractionStart={onInteractionStart}
          onInteractionEnd={onInteractionEnd}
        />
      </div>
    </div>
  );
};
