import React, { useState, useEffect } from 'react';
import type { AdjustmentParameters, EditorTab } from '../../types/editor';
import { AiService } from '../../services/ai/aiService';
import { PARAM_LIMITS, clampParameter } from '../../services/ai/schema';
import type { AiEditPlan, AiParameterDiff } from '../../services/ai/types';
import { PRESETS } from '../../data/presets';

interface AiAssistantPanelProps {
  currentAdjustments: AdjustmentParameters;
  currentPresetId: string | null;
  currentPresetIntensity: number;
  onApplyPlan: (plan: AiEditPlan) => void;
  onPreviewPlan?: (
    previewAdjustments: AdjustmentParameters | null,
    presetId?: string | null,
    intensity?: number
  ) => void;
  onCancel?: () => void;
  onSwitchTab?: (tab: EditorTab) => void;
}

const EXAMPLE_PROMPTS = [
  'Make this photo warmer and slightly brighter',
  'Give it a cinematic look with muted highlights',
  'Increase contrast but preserve skin tones as much as possible',
  'Lift the shadows and reduce saturation slightly',
  'Moody vintage film with subtle grain',
  'Dramatic black and white',
];

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  currentAdjustments,
  currentPresetId,
  currentPresetIntensity,
  onApplyPlan,
  onPreviewPlan,
  onCancel,
  onSwitchTab,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposedPlan, setProposedPlan] = useState<AiEditPlan | null>(null);
  const [activeDiffs, setActiveDiffs] = useState<AiParameterDiff[]>([]);
  const [editedParams, setEditedParams] = useState<Partial<AdjustmentParameters>>({});
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync diffs when a new proposed plan is returned
  useEffect(() => {
    if (proposedPlan && proposedPlan.supported) {
      setEditedParams({ ...proposedPlan.parameters });

      const diffs = Object.entries(proposedPlan.parameters).map(([key, val]) => {
        const paramKey = key as keyof AdjustmentParameters;
        const currentVal = currentAdjustments[paramKey] ?? 0;
        const proposedVal = typeof val === 'number' ? val : currentVal;
        return {
          param: paramKey,
          current: currentVal,
          proposed: proposedVal,
          delta: Math.round((proposedVal - currentVal) * 100) / 100,
          unit: PARAM_LIMITS[paramKey]?.unit || '%',
        };
      });
      setActiveDiffs(diffs);
    } else {
      setActiveDiffs([]);
      setEditedParams({});
    }
  }, [proposedPlan, currentAdjustments]);

  // Update live preview when user toggles preview or tweaks sliders
  useEffect(() => {
    if (isPreviewActive && proposedPlan && onPreviewPlan) {
      const merged: AdjustmentParameters = {
        ...currentAdjustments,
        ...editedParams,
      };
      onPreviewPlan(
        merged,
        proposedPlan.presetId || currentPresetId,
        proposedPlan.presetIntensity ?? currentPresetIntensity
      );
    } else if (!isPreviewActive && onPreviewPlan) {
      onPreviewPlan(null);
    }
  }, [
    isPreviewActive,
    editedParams,
    proposedPlan,
    currentAdjustments,
    currentPresetId,
    currentPresetIntensity,
    onPreviewPlan,
  ]);

  // Cancel preview when unmounting or resetting
  useEffect(() => {
    return () => {
      if (onPreviewPlan) onPreviewPlan(null);
    };
  }, [onPreviewPlan]);

  const handleGenerate = async (queryText?: string) => {
    if (isGenerating) return;
    const textToSubmit = (queryText || prompt).trim();
    if (!textToSubmit) return;

    if (queryText) setPrompt(queryText);
    setIsGenerating(true);
    setErrorMessage(null);
    setProposedPlan(null);
    setIsPreviewActive(false);

    try {
      const plan = await AiService.generateEditPlan({
        prompt: textToSubmit,
        currentAdjustments,
        currentPresetId,
        currentPresetIntensity,
      });

      setProposedPlan(plan);
      if (plan.supported) {
        setIsPreviewActive(true); // Automatically show live preview of proposal
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        // User cancelled
        return;
      }
      setErrorMessage(
        (err as Error)?.message || 'Could not generate edit plan. Please check your connection or try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancelGeneration = () => {
    AiService.cancelActiveRequest();
    setIsGenerating(false);
  };

  const handleParamTweak = (key: keyof AdjustmentParameters, value: number) => {
    const clamped = clampParameter(key, value);
    setEditedParams((prev) => ({
      ...prev,
      [key]: clamped,
    }));

    // Update diff list
    setActiveDiffs((prev) =>
      prev.map((d) => {
        if (d.param === key) {
          return {
            ...d,
            proposed: clamped,
            delta: Math.round((clamped - d.current) * 100) / 100,
          };
        }
        return d;
      })
    );
  };

  const handleApply = () => {
    if (!proposedPlan) return;
    const finalPlan: AiEditPlan = {
      ...proposedPlan,
      parameters: editedParams,
    };
    if (onPreviewPlan) onPreviewPlan(null);
    onApplyPlan(finalPlan);
    setProposedPlan(null);
    setIsPreviewActive(false);
  };

  const handleDiscard = () => {
    if (onPreviewPlan) onPreviewPlan(null);
    setProposedPlan(null);
    setIsPreviewActive(false);
    if (onCancel) onCancel();
  };

  const suggestedPreset = proposedPlan?.presetId
    ? PRESETS.find((p) => p.id === proposedPlan.presetId)
    : null;

  return (
    <div className="w-full bg-[#0D1424]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-4 text-white shadow-2xl flex flex-col gap-3">
      {/* Header & Privacy disclosure */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#8B5CF6] via-[#EC4899] to-[#F59E0B] p-0.5 flex items-center justify-center shadow-[0_0_12px_rgba(139,92,246,0.5)]">
            <div className="w-full h-full bg-[#070B14] rounded-[6px] flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] text-transparent bg-clip-text bg-gradient-to-tr from-[#8B5CF6] to-[#EC4899]">
                auto_awesome
              </span>
            </div>
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-[#8B5CF6] bg-clip-text text-transparent">
              Chroma AI Photo Assistant
            </h3>
            <p className="text-[10px] text-slate-400">Describe desired colors, lighting, mood or style</p>
          </div>
        </div>

        {/* Privacy reassurance badge */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
          <span className="material-symbols-outlined text-[12px]">lock</span>
          <span>100% Private · Zero Photo Upload</span>
        </div>
      </div>

      {/* Prompt input and action button */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isGenerating && prompt.trim()) {
                e.preventDefault();
                handleGenerate();
              } else if (e.key === 'Escape') {
                if (proposedPlan) {
                  handleDiscard();
                } else if (isGenerating) {
                  handleCancelGeneration();
                }
              }
            }}
            placeholder='e.g. "Make this warmer and slightly brighter" or "Moody cinematic look"'
            disabled={isGenerating}
            aria-label="Describe desired photo edits in natural language"
            className="w-full bg-[#070B14] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6] transition-all"
          />
          {prompt && !isGenerating && (
            <button
              onClick={() => setPrompt('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {isGenerating ? (
          <button
            onClick={handleCancelGeneration}
            className="h-10 px-4 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-rose-500/30 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
            <span>Cancel</span>
          </button>
        ) : (
          <button
            onClick={() => handleGenerate()}
            disabled={!prompt.trim()}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#F59E0B] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_16px_rgba(139,92,246,0.4)] hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">sparkles</span>
            <span>Generate Plan</span>
          </button>
        )}
      </div>

      {/* Suggestion prompt chips (shown when not currently reviewing a proposal) */}
      {!proposedPlan && !isGenerating && (
        <div className="flex flex-col gap-1.5 pt-0.5">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
            Quick Prompts
          </span>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map((example, i) => (
              <button
                key={i}
                onClick={() => handleGenerate(example)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/5 hover:border-white/15 text-slate-300 hover:text-white transition-all cursor-pointer text-left flex items-center gap-1"
              >
                <span className="text-[#8B5CF6] text-[10px]">✦</span>
                <span>{example}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state indicator */}
      {isGenerating && (
        <div className="py-6 flex flex-col items-center justify-center gap-2.5 text-center">
          <div className="w-9 h-9 rounded-full border-2 border-[#8B5CF6] border-t-transparent animate-spin" />
          <p className="text-xs font-medium text-slate-300">
            Analyzing instruction and preparing color-grading parameters...
          </p>
          <span className="text-[10px] text-slate-500">
            Consulting on-device photographic rules &amp; AI boundaries
          </span>
        </div>
      )}

      {/* Error state */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px] text-rose-400 mt-0.5">error</span>
          <div className="flex-1">
            <p className="font-semibold">{errorMessage}</p>
            <button
              onClick={() => handleGenerate()}
              className="mt-1.5 text-[11px] underline font-bold text-rose-300 hover:text-rose-200 cursor-pointer"
            >
              Retry request
            </button>
          </div>
        </div>
      )}

      {/* Proposed Edit Plan Card */}
      {proposedPlan && (
        <div className="flex flex-col gap-3 pt-1">
          {proposedPlan.supported ? (
            <div className="flex flex-col gap-3 bg-[#070B14]/70 border border-[#8B5CF6]/30 rounded-xl p-3 shadow-inner">
              {/* Proposal Header & Preview Switch */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#EC4899]">
                    insights
                  </span>
                  <span className="text-xs font-bold text-slate-200">Proposed Edit Recipe</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Hold to Compare Original */}
                  {isPreviewActive && (
                    <button
                      onMouseDown={() => {
                        if (onPreviewPlan) onPreviewPlan(currentAdjustments, currentPresetId, currentPresetIntensity);
                      }}
                      onMouseUp={() => {
                        if (onPreviewPlan && isPreviewActive) {
                          onPreviewPlan({ ...currentAdjustments, ...editedParams }, proposedPlan.presetId || currentPresetId, proposedPlan.presetIntensity ?? currentPresetIntensity);
                        }
                      }}
                      onTouchStart={() => {
                        if (onPreviewPlan) onPreviewPlan(currentAdjustments, currentPresetId, currentPresetIntensity);
                      }}
                      onTouchEnd={() => {
                        if (onPreviewPlan && isPreviewActive) {
                          onPreviewPlan({ ...currentAdjustments, ...editedParams }, proposedPlan.presetId || currentPresetId, proposedPlan.presetIntensity ?? currentPresetIntensity);
                        }
                      }}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white/5 hover:bg-white/10 text-slate-300 flex items-center gap-1 active:bg-[#8B5CF6]/20 transition-all select-none touch-none cursor-pointer"
                      title="Press & hold to see original photo before proposed edits"
                      aria-label="Hold to preview original photo"
                    >
                      <span className="material-symbols-outlined text-[13px]">compare</span>
                      <span>Hold for Original</span>
                    </button>
                  )}

                  {/* Preview Toggle */}
                  <button
                    onClick={() => setIsPreviewActive(!isPreviewActive)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      isPreviewActive
                        ? 'bg-[#8B5CF6] text-white shadow-[0_0_10px_rgba(139,92,246,0.5)]'
                        : 'bg-white/10 text-slate-300 hover:text-white'
                    }`}
                    aria-label={isPreviewActive ? 'Toggle preview off' : 'Toggle live preview on'}
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {isPreviewActive ? 'visibility' : 'visibility_off'}
                    </span>
                    <span>{isPreviewActive ? 'Previewing On' : 'Preview Off'}</span>
                  </button>
                </div>
              </div>

              {/* Explanation text */}
              <p className="text-xs text-slate-200 leading-relaxed font-normal bg-white/5 p-2.5 rounded-lg border border-white/5">
                {proposedPlan.explanation}
              </p>

              {/* Explicit Record of Parameter Corrections / Bounds Clamping */}
              {proposedPlan.corrections && proposedPlan.corrections.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-2.5 flex flex-col gap-1 text-[11px] text-amber-200">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <span className="material-symbols-outlined text-[15px]">tune</span>
                    <span>Boundary Adjustments Recorded ({proposedPlan.corrections.length})</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-amber-200/90 text-[10px]">
                    {proposedPlan.corrections.map((corr, idx) => (
                      <li key={idx}>{corr.reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preset badge if suggested */}
              {suggestedPreset && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-[#8B5CF6]/20 to-[#EC4899]/20 border border-[#8B5CF6]/30">
                  <span className="material-symbols-outlined text-[16px] text-[#8B5CF6]">palette</span>
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      Recommended Style Preset
                    </span>
                    <span className="text-xs font-bold text-white">
                      {suggestedPreset.name} ({proposedPlan.presetIntensity ?? 100}%)
                    </span>
                  </div>
                </div>
              )}

              {/* Parameter Diffs with interactive fine-tuning */}
              {activeDiffs.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Parameter Adjustments ({activeDiffs.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeDiffs.map((diff) => {
                      const limit = PARAM_LIMITS[diff.param];
                      const isExposure = diff.param === 'exposure';
                      const formatVal = (v: number) =>
                        isExposure ? `${v >= 0 ? '+' : ''}${v.toFixed(2)} EV` : `${v >= 0 ? '+' : ''}${Math.round(v)}%`;

                      return (
                        <div
                          key={diff.param}
                          className="bg-white/5 p-2 rounded-lg border border-white/5 flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-300 capitalize">
                              {diff.param}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-slate-400">
                                {formatVal(diff.current)} →
                              </span>
                              <span
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                  diff.delta >= 0
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-indigo-500/20 text-indigo-400'
                                }`}
                              >
                                {formatVal(diff.proposed)}
                              </span>
                            </div>
                          </div>

                          {/* Mini interactive tweak scrubber */}
                          <input
                            type="range"
                            min={limit.min}
                            max={limit.max}
                            step={limit.step}
                            value={diff.proposed}
                            onChange={(e) =>
                              handleParamTweak(diff.param, parseFloat(e.target.value))
                            }
                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#8B5CF6]"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons: Apply vs Discard */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  onClick={handleDiscard}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                  <span>Discard</span>
                </button>
                <button
                  onClick={handleApply}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#F59E0B] text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_16px_rgba(139,92,246,0.4)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Apply to Photo</span>
                </button>
              </div>
            </div>
          ) : (
            /* Unsupported request card with alternatives */
            <div className="flex flex-col gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-200">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-amber-400">
                  handyman
                </span>
                <span className="text-xs font-bold text-amber-300">
                  Capability Notice: Outside Photographic Grading
                </span>
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed font-normal">
                {proposedPlan.unsupportedReason ||
                  'Generative inpainting and object replacement are not supported by Chroma Studio.'}
              </p>

              {proposedPlan.suggestedAlternatives && proposedPlan.suggestedAlternatives.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="text-[10px] uppercase font-bold text-amber-300/80">
                    Supported Alternatives:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {proposedPlan.suggestedAlternatives.map((alt, i) => (
                      <div
                        key={i}
                        className="text-[11px] px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-100 flex items-center gap-1"
                      >
                        <span className="text-amber-400">✓</span>
                        <span>{alt}</span>
                      </div>
                    ))}
                  </div>

                  {onSwitchTab && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => onSwitchTab('cutout')}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">person_remove</span>
                        <span>Open Cutout Tab</span>
                      </button>
                      <button
                        onClick={() => onSwitchTab('colorlab')}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">palette</span>
                        <span>Open Color Lab</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setProposedPlan(null)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold cursor-pointer transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
