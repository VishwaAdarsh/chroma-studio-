import React, { useState, useRef } from 'react';
import type { BackgroundReplacementState, CutoutState } from '../../types/editor';
import { Scrubber } from '../Scrubber';
import { aiBackgroundService } from '../../services/background';
import { useSubscription } from '../../contexts/SubscriptionContext';

interface BackgroundReplacementPanelProps {
  backgroundState: BackgroundReplacementState;
  cutout: CutoutState;
  onChange: (state: BackgroundReplacementState) => void;
  onReset: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  onRunAiSegmentation?: (provider: 'on-device' | 'cloud', userConsent: boolean) => Promise<void>;
  isSegmenting?: boolean;
  onToggleCompare?: () => void;
  isComparing?: boolean;
}

const PRESET_COLORS = [
  { id: 'white', label: 'Studio White', color: '#FFFFFF' },
  { id: 'dark', label: 'Dark Studio', color: '#070B14' },
  { id: 'slate', label: 'Slate Gray', color: '#64748B' },
  { id: 'sand', label: 'Warm Sand', color: '#F5EBE0' },
  { id: 'violet', label: 'Neon Violet', color: '#8B5CF6' },
  { id: 'coral', label: 'Sunset Coral', color: '#F43F5E' },
  { id: 'emerald', label: 'Emerald Green', color: '#10B981' },
  { id: 'sky', label: 'Ocean Blue', color: '#0EA5E9' },
];

const PROMPT_SUGGESTIONS = [
  'Sunset beach with warm golden hour waves and soft horizon',
  'Modern luxury architectural studio interior with soft sunlight',
  'Misty pine forest in morning light with gentle cinematic fog',
  'Cozy boutique cafe interior with warm lights and lens bokeh',
  'Cyberpunk neon street corner at night with rain puddle reflections',
];

export const BackgroundReplacementPanel: React.FC<BackgroundReplacementPanelProps> = ({
  backgroundState,
  cutout,
  onChange,
  onReset,
  onInteractionStart,
  onInteractionEnd,
  onRunAiSegmentation,
  isSegmenting = false,
  onToggleCompare,
  isComparing = false,
}) => {
  const isEnabled = backgroundState.enabled;
  const mode = backgroundState.mode;

  const { checkFeatureAccess, isPro } = useSubscription();

  const [activeSubTab, setActiveSubTab] = useState<'backdrop' | 'foreground'>('backdrop');
  const [promptText, setPromptText] = useState(backgroundState.aiPrompt || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStatus, setGenStatus] = useState('');
  const [genError, setGenError] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleToggle = () => {
    onInteractionStart?.();
    onChange({
      ...backgroundState,
      enabled: !isEnabled,
    });
    onInteractionEnd?.();
  };

  const handleModeChange = (newMode: 'color' | 'image' | 'ai') => {
    onInteractionStart?.();
    onChange({
      ...backgroundState,
      enabled: true,
      mode: newMode,
    });
    onInteractionEnd?.();
  };

  const handleColorSelect = (hex: string) => {
    onInteractionStart?.();
    onChange({
      ...backgroundState,
      enabled: true,
      mode: 'color',
      color: hex,
    });
    onInteractionEnd?.();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onInteractionStart?.();
        onChange({
          ...backgroundState,
          enabled: true,
          mode: 'image',
          imageSrc: dataUrl,
          imageName: file.name,
        });
        onInteractionEnd?.();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGenerateAi = async () => {
    if (isGenerating) return;
    if (!promptText.trim()) return;

    const hasAccess = checkFeatureAccess(
      'ai_background_gen',
      undefined,
      'Upgrade to Chroma Pro to synthesize custom AI backdrops and scenes.'
    );
    if (!hasAccess) return;

    if (!backgroundState.hasUserConsent) {
      setShowConsentModal(true);
      return;
    }

    try {
      setIsGenerating(true);
      setGenError(null);
      setGenProgress(10);
      setGenStatus('Initializing backdrop generator...');

      abortControllerRef.current = new AbortController();

      const result = await aiBackgroundService.generateBackground({
        prompt: promptText.trim(),
        userConsent: true,
        signal: abortControllerRef.current.signal,
        onProgress: (percent, status) => {
          setGenProgress(percent);
          setGenStatus(status);
        },
      });

      onInteractionStart?.();
      onChange({
        ...backgroundState,
        enabled: true,
        mode: 'ai',
        aiPrompt: promptText.trim(),
        aiGeneratedSrc: result.imageUrl,
        aiProvider: result.provider,
      });
      onInteractionEnd?.();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setGenError(err.message || 'Failed to generate background.');
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleConsentAccept = () => {
    setShowConsentModal(false);
    onChange({
      ...backgroundState,
      hasUserConsent: true,
    });
    setTimeout(() => {
      handleGenerateAi();
    }, 50);
  };

  const handleCancelGeneration = () => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
    setGenStatus('Generation cancelled');
  };

  const handleResetForeground = () => {
    onInteractionStart?.();
    onChange({
      ...backgroundState,
      fgTransform: {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      },
    });
    onInteractionEnd?.();
  };

  const hasCutoutSubject = cutout.enabled || (cutout.maskAlpha && cutout.maskAlpha.length > 0);

  return (
    <div className="w-full bg-[#0D1424] border border-white/10 rounded-2xl p-3 sm:p-4 space-y-3.5 shadow-lg select-none">
      {/* Top Banner: Master Toggle & Reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/15 text-[#A78BFA] flex items-center justify-center border border-[#8B5CF6]/20 shadow-xs">
            <span className="material-symbols-outlined text-[20px]">wallpaper</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-bold text-white tracking-wide">
                AI Background Replacement
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/25 text-[#C4B5FD] font-mono font-bold border border-[#8B5CF6]/30">
                AI COMPOSITOR
              </span>
            </div>
            <p className="text-[10px] text-[#94A3B8]">
              {isEnabled
                ? 'Subject composited over replacement backdrop'
                : 'Replace original background with Color, Image, or AI Scene'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEnabled && (
            <button
              onClick={onReset}
              className="text-[10px] text-[#94A3B8] hover:text-white flex items-center gap-1 transition-colors cursor-pointer min-h-[44px] px-2.5 rounded-lg hover:bg-white/5 active:scale-95"
              title="Reset backdrop"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              <span className="hidden xs:inline">Reset</span>
            </button>
          )}

          <button
            onClick={handleToggle}
            className={`w-12 h-6.5 rounded-full transition-all p-0.5 flex items-center cursor-pointer min-h-[44px] focus:outline-hidden ${
              isEnabled ? 'bg-[#8B5CF6] justify-end' : 'bg-white/10 justify-start'
            }`}
            title={isEnabled ? 'Disable background replacement' : 'Enable background replacement'}
            aria-label="Toggle background replacement"
          >
            <div className="w-5.5 h-5.5 rounded-full bg-white shadow-md transition-transform" />
          </button>
        </div>
      </div>

      {/* Subject Isolation Status Banner */}
      {!hasCutoutSubject && onRunAiSegmentation && (
        <div className="p-3 bg-[#1E1B4B]/50 border border-[#8B5CF6]/30 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#C4B5FD] text-[11px]">
            <span className="material-symbols-outlined text-[18px]">person_search</span>
            <span>Subject must be isolated to composite replacement backdrop.</span>
          </div>
          <button
            onClick={() => onRunAiSegmentation('on-device', false)}
            disabled={isSegmenting}
            className="px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-[11px] font-semibold rounded-lg shrink-0 flex items-center gap-1.5 min-h-[38px] active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {isSegmenting ? (
              <>
                <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                <span>Isolating...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                <span>Extract Subject</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Layer Sub-Tabs: Backdrop vs Subject Positioning */}
      <div className="flex items-center gap-1 bg-[#070B14] p-1 rounded-xl border border-white/5">
        <button
          onClick={() => setActiveSubTab('backdrop')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all min-h-[40px] flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'backdrop'
              ? 'bg-[#8B5CF6] text-white shadow-sm'
              : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">wallpaper</span>
          <span>Backdrop Source</span>
        </button>

        <button
          onClick={() => setActiveSubTab('foreground')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all min-h-[40px] flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'foreground'
              ? 'bg-[#8B5CF6] text-white shadow-sm'
              : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">accessibility_new</span>
          <span>Subject Position</span>
        </button>
      </div>

      {/* TAB 1: BACKDROP SOURCE */}
      {activeSubTab === 'backdrop' && (
        <div className="space-y-3.5">
          {/* Mode Selector Chips */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'color', label: 'Solid Color', icon: 'palette' },
              { id: 'image', label: 'Custom Image', icon: 'add_photo_alternate' },
              { id: 'ai', label: 'AI Scene', icon: 'auto_awesome' },
            ].map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => handleModeChange(m.id as any)}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition-all min-h-[48px] cursor-pointer active:scale-95 ${
                    active
                      ? 'bg-[#8B5CF6]/15 border-[#8B5CF6] text-white shadow-sm'
                      : 'bg-[#070B14] border-white/5 text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px] mb-0.5">{m.icon}</span>
                  <span className="text-[10px] font-semibold">{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* MODE A: SOLID COLOR */}
          {mode === 'color' && (
            <div className="space-y-2.5 p-3 bg-[#070B14] rounded-xl border border-white/5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#94A3B8] block">
                Preset Studio Colors
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {PRESET_COLORS.map((c) => {
                  const isSelected = backgroundState.color.toLowerCase() === c.color.toLowerCase();
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleColorSelect(c.color)}
                      className={`h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer min-h-[44px] ${
                        isSelected
                          ? 'border-white scale-105 shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                      style={{ backgroundColor: c.color }}
                      title={c.label}
                    >
                      {isSelected && (
                        <span
                          className={`material-symbols-outlined text-[16px] ${
                            c.color === '#FFFFFF' || c.color === '#F5EBE0'
                              ? 'text-black'
                              : 'text-white'
                          }`}
                        >
                          check
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Custom Color Input */}
              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <span className="text-[11px] text-[#CBD5E1]">Custom Color Hex</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={backgroundState.color}
                    onChange={(e) => handleColorSelect(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 min-h-[36px]"
                  />
                  <span className="text-[11px] font-mono text-[#94A3B8] uppercase">
                    {backgroundState.color}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* MODE B: CUSTOM UPLOADED IMAGE */}
          {mode === 'image' && (
            <div className="space-y-3 p-3 bg-[#070B14] rounded-xl border border-white/5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />

              {backgroundState.imageSrc ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3 p-2 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <img
                        src={backgroundState.imageSrc}
                        alt="Custom backdrop"
                        className="w-10 h-10 rounded-md object-cover border border-white/10 shrink-0"
                      />
                      <div className="truncate">
                        <span className="text-[11px] text-white font-medium block truncate">
                          {backgroundState.imageName || 'Custom Background'}
                        </span>
                        <span className="text-[9px] text-[#94A3B8]">Uploaded Asset</span>
                      </div>
                    </div>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/15 text-white text-[10px] font-medium rounded-lg shrink-0 min-h-[36px] flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">swap_horiz</span>
                      <span>Change</span>
                    </button>
                  </div>

                  {/* Fit Mode Switcher */}
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-[#94A3B8]">Fit Scaling</span>
                    <div className="flex gap-1">
                      {(['cover', 'contain', 'fill'] as const).map((fit) => (
                        <button
                          key={fit}
                          onClick={() => {
                            onChange({
                              ...backgroundState,
                              bgTransform: { ...backgroundState.bgTransform, fit },
                            });
                          }}
                          className={`px-2 py-1 rounded text-[10px] capitalize font-medium min-h-[36px] cursor-pointer ${
                            backgroundState.bgTransform.fit === fit
                              ? 'bg-[#8B5CF6] text-white'
                              : 'bg-white/5 text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          {fit}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background Zoom Scrubber */}
                  <Scrubber
                    label="Backdrop Zoom"
                    value={Math.round((backgroundState.bgTransform.scale - 1) * 100)}
                    min={-50}
                    max={150}
                    step={1}
                    unit="%"
                    onChange={(val) => {
                      onChange({
                        ...backgroundState,
                        bgTransform: {
                          ...backgroundState.bgTransform,
                          scale: 1 + val / 100,
                        },
                      });
                    }}
                    onReset={() => {
                      onChange({
                        ...backgroundState,
                        bgTransform: {
                          ...backgroundState.bgTransform,
                          scale: 1,
                        },
                      });
                    }}
                  />

                  {/* Depth of Field Blur */}
                  <Scrubber
                    label="Lens Bokeh Blur"
                    value={backgroundState.bgTransform.blur}
                    min={0}
                    max={20}
                    step={1}
                    unit="px"
                    onChange={(val) => {
                      onChange({
                        ...backgroundState,
                        bgTransform: {
                          ...backgroundState.bgTransform,
                          blur: val,
                        },
                      });
                    }}
                    onReset={() => {
                      onChange({
                        ...backgroundState,
                        bgTransform: {
                          ...backgroundState.bgTransform,
                          blur: 0,
                        },
                      });
                    }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 border-2 border-dashed border-white/15 hover:border-[#8B5CF6]/50 rounded-xl flex flex-col items-center justify-center gap-2 text-[#94A3B8] hover:text-white transition-all cursor-pointer min-h-[100px] active:scale-98"
                >
                  <span className="material-symbols-outlined text-[28px] text-[#A78BFA]">
                    cloud_upload
                  </span>
                  <div className="text-center">
                    <span className="text-[12px] font-semibold text-white block">
                      Choose Replacement Photo
                    </span>
                    <span className="text-[10px] text-[#64748B]">PNG, JPG, or WebP</span>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* MODE C: AI SCENE GENERATOR */}
          {mode === 'ai' && (
            <div className="space-y-3 p-3 bg-[#070B14] rounded-xl border border-white/5">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono tracking-wider text-[#94A3B8] block">
                  Describe Scene Atmosphere
                </label>
                <div className="relative">
                  <textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="e.g. Sunset beach with warm golden hour waves and soft horizon"
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-[12px] text-white placeholder-white/30 focus:outline-hidden focus:border-[#8B5CF6] resize-none"
                  />
                  {promptText && (
                    <button
                      onClick={() => setPromptText('')}
                      className="absolute top-2 right-2 text-white/40 hover:text-white p-1 rounded min-h-[30px]"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Prompt Suggestions */}
              <div className="space-y-1">
                <span className="text-[9px] text-[#64748B]">Curated portrait backdrops:</span>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {PROMPT_SUGGESTIONS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPromptText(item)}
                      className="text-[9px] px-2 py-1 bg-white/5 hover:bg-[#8B5CF6]/15 hover:text-[#C4B5FD] text-[#94A3B8] rounded-full border border-white/5 whitespace-nowrap shrink-0 transition-all cursor-pointer min-h-[32px] flex items-center"
                    >
                      {item.split(' ')[0]} {item.split(' ')[1]}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress Bar & Status during generation */}
              {isGenerating && (
                <div className="p-2.5 bg-[#1E1B4B]/40 border border-[#8B5CF6]/30 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[#C4B5FD]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
                      <span className="font-semibold">{genStatus}</span>
                    </div>
                    <span className="font-mono text-white text-[10px]">{genProgress}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] transition-all duration-200"
                      style={{ width: `${Math.max(5, genProgress)}%` }}
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleCancelGeneration}
                      className="text-[10px] text-red-400 hover:text-red-300 min-h-[32px] px-2 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Error message */}
              {genError && (
                <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-[11px] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{genError}</span>
                </div>
              )}

              {/* Generate Trigger Button */}
              <button
                onClick={handleGenerateAi}
                disabled={isGenerating || !promptText.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:opacity-95 text-white font-bold text-[12px] rounded-xl flex items-center justify-center gap-2 min-h-[44px] shadow-lg cursor-pointer transition-all active:scale-98 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                <span>{backgroundState.aiGeneratedSrc ? 'Regenerate Scene' : 'Generate AI Backdrop'}</span>
              </button>

              {/* Privacy Disclosure Notice */}
              <div className="flex items-center gap-1.5 text-[9px] text-[#64748B] pt-0.5">
                <span className="material-symbols-outlined text-[12px] text-[#8B5CF6]">verified_user</span>
                <span>Requires user consent before contacting generative cloud APIs.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FOREGROUND SUBJECT TUNING */}
      {activeSubTab === 'foreground' && (
        <div className="space-y-3 p-3 bg-[#070B14] rounded-xl border border-white/5">
          <div className="flex items-center justify-between pb-1 border-b border-white/5">
            <span className="text-[11px] font-semibold text-white">Subject Placement</span>
            <button
              onClick={handleResetForeground}
              className="text-[10px] text-[#94A3B8] hover:text-white flex items-center gap-1 cursor-pointer min-h-[36px]"
            >
              <span className="material-symbols-outlined text-[12px]">filter_center_focus</span>
              <span>Center Subject</span>
            </button>
          </div>

          {/* Subject Scale */}
          <Scrubber
            label="Subject Scale"
            value={Math.round((backgroundState.fgTransform.scale - 1) * 100)}
            min={-50}
            max={50}
            step={1}
            unit="%"
            onChange={(val) => {
              onChange({
                ...backgroundState,
                fgTransform: {
                  ...backgroundState.fgTransform,
                  scale: 1 + val / 100,
                },
              });
            }}
            onReset={() => {
              onChange({
                ...backgroundState,
                fgTransform: {
                  ...backgroundState.fgTransform,
                  scale: 1,
                },
              });
            }}
          />

          {/* Subject X Offset */}
          <Scrubber
            label="Horizontal Position"
            value={backgroundState.fgTransform.offsetX}
            min={-50}
            max={50}
            step={1}
            unit="%"
            onChange={(val) => {
              onChange({
                ...backgroundState,
                fgTransform: {
                  ...backgroundState.fgTransform,
                  offsetX: val,
                },
              });
            }}
            onReset={() => {
              onChange({
                ...backgroundState,
                fgTransform: {
                  ...backgroundState.fgTransform,
                  offsetX: 0,
                },
              });
            }}
          />

          {/* Subject Y Offset */}
          <Scrubber
            label="Vertical Position"
            value={backgroundState.fgTransform.offsetY}
            min={-50}
            max={50}
            step={1}
            unit="%"
            onChange={(val) => {
              onChange({
                ...backgroundState,
                fgTransform: {
                  ...backgroundState.fgTransform,
                  offsetY: val,
                },
              });
            }}
            onReset={() => {
              onChange({
                ...backgroundState,
                fgTransform: {
                  ...backgroundState.fgTransform,
                  offsetY: 0,
                },
              });
            }}
          />
        </div>
      )}

      {/* Compare Before/After Button */}
      {isEnabled && onToggleCompare && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onToggleCompare}
            className={`w-full py-2 rounded-xl text-[11px] font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] ${
              isComparing
                ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                : 'bg-white/5 text-[#94A3B8] hover:text-white border-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isComparing ? 'visibility' : 'compare'}
            </span>
            <span>{isComparing ? 'Viewing Original Photo' : 'Compare Before / After'}</span>
          </button>
        </div>
      )}

      {/* Privacy Consent Modal for AI Scene Generation */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D1424] border border-[#8B5CF6]/40 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/20 text-[#A78BFA] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">privacy_tip</span>
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-white">AI Generation Consent</h4>
                <p className="text-[10px] text-[#94A3B8]">Cloud Processing Privacy Disclosure</p>
              </div>
            </div>

            <p className="text-[11px] text-[#CBD5E1] leading-relaxed">
              Generating an AI scene sends your text prompt to Chroma Studio&apos;s generative cloud
              service. Your original photo remains private on your device.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConsentModal(false)}
                className="px-3 py-2 rounded-xl text-[11px] text-[#94A3B8] hover:text-white hover:bg-white/5 min-h-[44px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConsentAccept}
                className="px-4 py-2 rounded-xl text-[11px] font-semibold bg-[#8B5CF6] hover:bg-[#7C3AED] text-white min-h-[44px] shadow-lg cursor-pointer"
              >
                Agree &amp; Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
