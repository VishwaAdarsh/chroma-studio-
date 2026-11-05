import React, { useMemo, useState } from 'react';
import { TEMPLATE_CATEGORIES, TEMPLATES } from '../../data/presets';
import { StorageService } from '../../services/storage';
import {
  smartPresetService,
  type PresetRecommendation,
  type ImageAnalysisMetrics,
} from '../../services/smartPresets';
import type {
  AdjustmentParameters,
  ColorWheels,
  HslAdjustments,
  PhotoTemplate,
  Preset,
  TemplateCategory,
  ToneCurves,
} from '../../types/editor';

interface LooksPanelProps {
  activePresetId: string | null;
  presetIntensity: number;
  onSelectPreset: (preset: Preset | null) => void;
  onChangeIntensity: (intensity: number) => void;
  favorites: string[];
  onToggleFavorite: (presetId: string) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  currentAdjustments?: AdjustmentParameters;
  currentWheels?: ColorWheels;
  currentCurves?: ToneCurves;
  currentHsl?: HslAdjustments;
  imageElement?: HTMLImageElement | null;
  canvasElement?: HTMLCanvasElement | null;
}

export const LooksPanel: React.FC<LooksPanelProps> = ({
  activePresetId,
  presetIntensity,
  onSelectPreset,
  onChangeIntensity,
  favorites,
  onToggleFavorite,
  onInteractionStart,
  onInteractionEnd,
  currentAdjustments,
  currentWheels,
  currentCurves,
  currentHsl,
  imageElement,
  canvasElement,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<PhotoTemplate[]>(() =>
    StorageService.getCustomTemplates()
  );

  // Smart Presets state
  const [smartRecommendations, setSmartRecommendations] = useState<PresetRecommendation[] | null>(null);
  const [analysisMetrics, setAnalysisMetrics] = useState<ImageAnalysisMetrics | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [engineUsed, setEngineUsed] = useState<'deterministic-analysis' | 'cloud-ai' | null>(null);
  const [analysisDuration, setAnalysisDuration] = useState<number | null>(null);
  const [showMetricsDetails, setShowMetricsDetails] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Modal for saving custom template
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState<TemplateCategory>('Social Media');

  // Combined built-in and user-created custom templates
  const allTemplates = useMemo(() => {
    return [...customTemplates, ...TEMPLATES];
  }, [customTemplates]);

  const activeTemplate = useMemo(() => {
    return allTemplates.find((p) => p.id === activePresetId) || null;
  }, [allTemplates, activePresetId]);

  // Filter templates based on Category, Search Query, and Favorites
  const filteredTemplates = useMemo(() => {
    return allTemplates.filter((template) => {
      // Category filter
      if (selectedCategory !== 'All' && template.category !== selectedCategory) {
        return false;
      }

      // Favorites filter
      if (showOnlyFavorites && !favorites.includes(template.id)) {
        return false;
      }

      // Search Query filter (matches name, description, tags, or category)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = template.name.toLowerCase().includes(query);
        const matchesCategory = template.category.toLowerCase().includes(query);
        const matchesDesc = template.description.toLowerCase().includes(query);
        const matchesTags = template.tags?.some((t) => t.toLowerCase().includes(query));
        if (!matchesName && !matchesCategory && !matchesDesc && !matchesTags) {
          return false;
        }
      }

      return true;
    });
  }, [allTemplates, selectedCategory, showOnlyFavorites, favorites, searchQuery]);

  const handleSaveCustomTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;

    const newTemplate: PhotoTemplate = {
      id: `custom-${Date.now()}`,
      name: newTemplateName.trim(),
      category: newTemplateCategory,
      description: 'Custom created recipe from manual adjustments.',
      tags: ['custom', 'user', newTemplateCategory.toLowerCase()],
      defaultIntensity: 100,
      parameters: currentAdjustments ? { ...currentAdjustments } : {},
      wheels: currentWheels ? { ...currentWheels } : undefined,
      curves: currentCurves ? { ...currentCurves } : undefined,
      hsl: currentHsl ? { ...currentHsl } : undefined,
      thumbnailGradient: 'from-primary via-primary-container to-secondary',
      badge: 'Custom',
      isCustom: true,
    };

    const updated = StorageService.saveCustomTemplate(newTemplate);
    setCustomTemplates(updated);
    setIsSaveModalOpen(false);
    setNewTemplateName('');
    onSelectPreset(newTemplate);
  };

  const handleDuplicateCustomTemplate = (template: PhotoTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const duplicated: PhotoTemplate = {
      ...template,
      id: `custom-${Date.now()}`,
      name: `${template.name} (Copy)`,
      isCustom: true,
    };
    const updated = StorageService.saveCustomTemplate(duplicated);
    setCustomTemplates(updated);
    onSelectPreset(duplicated);
  };

  const handleRenameCustomTemplate = (template: PhotoTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const newName = window.prompt('Rename custom look:', template.name);
    if (newName && newName.trim() && newName.trim() !== template.name) {
      const renamed: PhotoTemplate = {
        ...template,
        name: newName.trim(),
      };
      const updated = StorageService.saveCustomTemplate(renamed);
      setCustomTemplates(updated);
      if (activePresetId === template.id) {
        onSelectPreset(renamed);
      }
    }
  };

  const handleDeleteCustomTemplate = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this custom template?')) {
      const updated = StorageService.deleteCustomTemplate(templateId);
      setCustomTemplates(updated);
      if (activePresetId === templateId) {
        onSelectPreset(null);
      }
    }
  };

  const handleRunSmartAnalysis = async (mode: 'deterministic' | 'cloud') => {
    if (isAnalyzing) return;
    const source = canvasElement || imageElement;
    if (!source) {
      setAnalysisError('No photo loaded in editor to analyze.');
      return;
    }

    if (mode === 'cloud') {
      const hasConsent = localStorage.getItem('chroma_smart_presets_cloud_consent') === 'true';
      if (!hasConsent) {
        setShowConsentModal(true);
        return;
      }
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisProgress(10);
    setAnalysisStatus('Starting vision analysis...');

    try {
      const result = await smartPresetService.recommendPresets(source, {
        provider: mode === 'cloud' ? 'cloud' : 'deterministic',
        userConsent: mode === 'cloud',
        onProgress: (pct, step) => {
          setAnalysisProgress(pct);
          setAnalysisStatus(step);
        },
      });

      setSmartRecommendations(result.recommendations);
      setAnalysisMetrics(result.metrics);
      setEngineUsed(result.provider);
      setAnalysisDuration(result.durationMs);
    } catch (err: any) {
      console.error('Smart Presets analysis failed:', err);
      setAnalysisError(err?.message || 'Failed to analyze photo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConsentAndProceed = (remember: boolean) => {
    if (remember) {
      localStorage.setItem('chroma_smart_presets_cloud_consent', 'true');
    }
    setShowConsentModal(false);
    handleRunSmartAnalysis('cloud');
  };

  return (
    <div className="w-full flex flex-col gap-2.5">
      {/* Top Controls: Search Bar, Favorites Filter, Save Preset Button */}
      <div className="flex items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1">
          <span className="material-symbols-outlined text-[16px] text-outline absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 40+ looks, tags, or styles..."
            className="w-full h-8 pl-8 pr-7 text-[11px] rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-0.5"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>

        {/* Favorites Only Toggle Pill */}
        <button
          onClick={() => setShowOnlyFavorites((prev) => !prev)}
          className={`h-8 px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition-all cursor-pointer ${
            showOnlyFavorites
              ? 'bg-primary text-white border-primary shadow-xs'
              : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary/50'
          }`}
          title="Filter bookmarked favorites"
        >
          <span
            className="material-symbols-outlined text-[14px]"
            style={{ fontVariationSettings: showOnlyFavorites ? "'FILL' 1" : "'FILL' 0" }}
          >
            favorite
          </span>
          <span className="hidden sm:inline">Favorites</span>
        </button>

        {/* Save Current Look Button */}
        {currentAdjustments && (
          <button
            onClick={() => setIsSaveModalOpen(true)}
            className="h-8 px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 bg-surface-container-high border border-outline-variant text-primary hover:bg-surface-container-highest transition-all cursor-pointer shadow-xs"
            title="Save current adjustments as a custom look"
          >
            <span className="material-symbols-outlined text-[14px]">bookmark_add</span>
            <span className="hidden sm:inline">Save Look</span>
          </button>
        )}
      </div>

      {/* Smart Presets Analysis Error Banner */}
      {analysisError && (
        <div className="bg-error/15 border border-error/30 text-error px-2.5 py-1.5 rounded-lg text-[10px] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">error</span>
            <span>{analysisError}</span>
          </div>
          <button
            onClick={() => setAnalysisError(null)}
            className="p-0.5 hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[12px]">close</span>
          </button>
        </div>
      )}

      {/* Smart Presets Recommendation Container */}
      {!smartRecommendations && !isAnalyzing && (
        <div className="bg-gradient-to-r from-primary/10 via-surface-container-low to-surface-container-low p-2.5 rounded-xl border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-bold text-on-surface">Smart Recommendations</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary/15 text-primary font-semibold">
                  AI & Vision
                </span>
              </div>
              <span className="text-[10px] text-on-surface-variant">
                Analyze lighting, contrast, and tones for intelligent curated looks.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => handleRunSmartAnalysis('deterministic')}
              disabled={!imageElement && !canvasElement}
              className="flex-1 sm:flex-initial h-7 px-2.5 rounded-lg text-[11px] font-bold bg-primary text-white hover:bg-primary-container shadow-xs flex items-center justify-center gap-1 cursor-pointer transition-all disabled:opacity-50"
              title="Instant on-device vision analysis (<10ms, offline, 100% private)"
            >
              <span className="material-symbols-outlined text-[14px]">bolt</span>
              <span>Analyze Photo</span>
            </button>
            <button
              onClick={() => handleRunSmartAnalysis('cloud')}
              disabled={!imageElement && !canvasElement}
              className="h-7 px-2 rounded-lg text-[11px] font-semibold bg-surface-container-high border border-outline-variant text-on-surface hover:text-primary hover:border-primary/50 shadow-xs flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
              title="Cloud AI vision aesthetic analysis"
            >
              <span className="material-symbols-outlined text-[14px]">cloud</span>
              <span className="hidden sm:inline">Cloud AI</span>
            </button>
          </div>
        </div>
      )}

      {/* Analyzing Progress State */}
      {isAnalyzing && (
        <div className="bg-surface-container-low p-2.5 rounded-xl border border-primary/30 flex flex-col gap-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[16px] animate-spin">
                progress_activity
              </span>
              <span className="text-[11px] font-bold text-on-surface">
                {analysisStatus || 'Analyzing photo characteristics...'}
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold text-primary tabular-nums">
              {analysisProgress}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Smart Recommendations Active Results */}
      {smartRecommendations && !isAnalyzing && (
        <div className="bg-surface-container-low p-2.5 rounded-xl border border-primary/30 flex flex-col gap-2 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="material-symbols-outlined text-primary text-[16px]">auto_awesome</span>
              <span className="text-[11px] font-bold text-on-surface">Recommended Looks</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${
                  engineUsed === 'cloud-ai'
                    ? 'bg-purple-950/60 border-purple-500/40 text-purple-300'
                    : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {engineUsed === 'cloud-ai'
                  ? 'Cloud AI Vision Match'
                  : 'Analytical Smart Match (On-Device Vision Analysis)'}
              </span>
              {analysisDuration !== null && (
                <span className="text-[9px] text-outline font-mono hidden sm:inline">
                  ({analysisDuration}ms)
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowMetricsDetails((prev) => !prev)}
                className="text-[10px] text-on-surface-variant hover:text-primary px-1.5 py-0.5 rounded bg-surface-container-high font-medium flex items-center gap-0.5 cursor-pointer"
                title="Toggle photometric analysis metrics"
              >
                <span className="material-symbols-outlined text-[12px]">analytics</span>
                <span>{showMetricsDetails ? 'Hide' : 'Metrics'}</span>
              </button>
              <button
                onClick={() =>
                  handleRunSmartAnalysis(engineUsed === 'cloud-ai' ? 'cloud' : 'deterministic')
                }
                className="text-[10px] text-on-surface-variant hover:text-primary px-1.5 py-0.5 rounded bg-surface-container-high font-medium flex items-center gap-0.5 cursor-pointer"
                title="Re-analyze photo"
              >
                <span className="material-symbols-outlined text-[12px]">refresh</span>
                <span>Re-scan</span>
              </button>
              <button
                onClick={() => {
                  setSmartRecommendations(null);
                  setAnalysisMetrics(null);
                }}
                className="text-[10px] text-outline hover:text-on-surface p-0.5 cursor-pointer"
                title="Dismiss recommendations"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          </div>

          {/* Photometric Metrics Drawer */}
          {showMetricsDetails && analysisMetrics && (
            <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
              <div>
                <span className="text-outline block text-[9px] uppercase font-semibold">
                  Luminance
                </span>
                <span className="text-on-surface font-medium">
                  {analysisMetrics.meanLuminance}/255 (
                  {analysisMetrics.isLowKey
                    ? 'Low-Key'
                    : analysisMetrics.isHighKey
                    ? 'High-Key'
                    : 'Balanced'}
                  )
                </span>
              </div>
              <div>
                <span className="text-outline block text-[9px] uppercase font-semibold">
                  Contrast & DR
                </span>
                <span className="text-on-surface font-medium">
                  {analysisMetrics.contrast}% ({analysisMetrics.dynamicRange} DR)
                </span>
              </div>
              <div>
                <span className="text-outline block text-[9px] uppercase font-semibold">
                  Color Temp
                </span>
                <span className="text-on-surface font-medium capitalize">
                  {analysisMetrics.colorTemperature} ({analysisMetrics.dominantHueFamily})
                </span>
              </div>
              <div>
                <span className="text-outline block text-[9px] uppercase font-semibold">
                  Scene Cues
                </span>
                <span className="text-on-surface font-medium truncate">
                  {[
                    analysisMetrics.isPortraitCandidate && 'Skin tones',
                    analysisMetrics.isLandscapeCandidate && 'Nature/Sky',
                    analysisMetrics.isGoldenHourCandidate && 'Golden Hour',
                  ]
                    .filter(Boolean)
                    .join(', ') || 'General Photo'}
                </span>
              </div>
            </div>
          )}

          {/* Recommendations Scroller */}
          <div className="flex items-stretch gap-2 overflow-x-auto no-scrollbar py-0.5">
            {smartRecommendations.map((rec) => {
              const isSelected = activePresetId === rec.preset.id;
              return (
                <div
                  key={rec.preset.id}
                  onClick={() => {
                    onSelectPreset(rec.preset);
                    onChangeIntensity(rec.suggestedIntensity);
                  }}
                  className={`flex-shrink-0 w-48 p-2 rounded-xl border flex flex-col justify-between gap-1.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40'
                      : 'border-outline-variant bg-surface-container-lowest hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[10px]">auto_awesome</span>
                      <span>{rec.matchScore}% Match</span>
                    </span>
                    <span className="text-[8px] font-semibold text-outline uppercase tracking-wider truncate max-w-[80px]">
                      {rec.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className={`w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br ${
                        rec.preset.thumbnailGradient || 'from-red-500 to-amber-700'
                      } border border-outline-variant relative`}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="material-symbols-outlined text-white text-[14px]">
                            check
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-bold text-on-surface truncate">
                        {rec.preset.name}
                      </span>
                      <span className="text-[9px] text-outline font-medium">
                        Strength {rec.suggestedIntensity}%
                      </span>
                    </div>
                  </div>

                  <p className="text-[9px] text-on-surface-variant leading-tight line-clamp-2 italic">
                    "{rec.reason}"
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Filter Horizontal Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {TEMPLATE_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat && !showOnlyFavorites;
          return (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setShowOnlyFavorites(false);
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-primary-container text-white font-semibold shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface border border-outline-variant'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Selected Template Details & Intensity Slider */}
      {activeTemplate && (
        <div className="bg-surface-container-low p-2.5 rounded-xl border border-outline-variant flex flex-col gap-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-on-surface flex items-center gap-1.5">
                {activeTemplate.name}
                {activeTemplate.badge && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-semibold uppercase">
                    {activeTemplate.badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] text-outline font-medium hidden sm:inline">
                • {activeTemplate.category}
              </span>
            </div>

            <button
              onClick={() => onSelectPreset(null)}
              className="text-[10px] text-outline hover:text-primary px-2 py-0.5 rounded bg-surface-container-high font-semibold flex items-center gap-0.5 cursor-pointer"
              title="Reset to Unfiltered Original"
            >
              <span className="material-symbols-outlined text-[12px]">refresh</span>
              <span>CLEAR LOOK</span>
            </button>
          </div>

          <p className="text-[10px] text-on-surface-variant leading-tight truncate">
            {activeTemplate.description}
          </p>

          {/* Look Strength Slider */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 min-w-[90px]">
              <span className="text-[10px] uppercase font-semibold text-on-surface-variant">
                Strength
              </span>
              <span className="text-[11px] font-mono font-bold text-primary tabular-nums">
                {presetIntensity}%
              </span>
            </div>
            <div className="relative flex-1 h-5 flex items-center">
              <input
                type="range"
                min="0"
                max="100"
                value={presetIntensity}
                onPointerDown={() => onInteractionStart?.()}
                onPointerUp={() => onInteractionEnd?.()}
                onTouchStart={() => onInteractionStart?.()}
                onTouchEnd={() => onInteractionEnd?.()}
                onChange={(e) => onChangeIntensity(parseInt(e.target.value, 10))}
                onDoubleClick={() => {
                  onInteractionStart?.();
                  onChangeIntensity(activeTemplate.defaultIntensity || 100);
                  onInteractionEnd?.();
                }}
                className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer focus:outline-none"
                style={{
                  background: `linear-gradient(to right, #bf0411 0%, #e42b27 ${presetIntensity}%, #ffe2de ${presetIntensity}%, #ffe2de 100%)`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Template Cards Horizontal Strip */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {/* Normal / Unfiltered item */}
        <div
          onClick={() => onSelectPreset(null)}
          className="flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer group active:scale-95 transition-all"
        >
          <div
            className={`w-14 h-14 rounded-xl overflow-hidden bg-surface-container-low flex items-center justify-center border transition-all ${
              activePresetId === null
                ? 'border-primary shadow-xs bg-surface-container-lowest ring-1 ring-primary/30'
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

        {/* Filtered Template items */}
        {filteredTemplates.map((template) => {
          const isSelected = activePresetId === template.id;
          const isFav = favorites.includes(template.id);

          return (
            <div
              key={template.id}
              onClick={() => onSelectPreset(template)}
              className="flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer group active:scale-95 transition-all relative"
            >
              <div
                className={`w-14 h-14 rounded-xl overflow-hidden relative shadow-xs transition-all ${
                  isSelected
                    ? 'border-2 border-primary shadow-md ring-2 ring-primary/20'
                    : 'border border-outline-variant group-hover:border-primary/50'
                }`}
              >
                {/* Look Visual Swatch */}
                <div
                  className={`w-full h-full bg-gradient-to-br ${
                    template.thumbnailGradient || 'from-red-500 to-amber-700'
                  }`}
                />

                {/* Badge if present */}
                {template.badge && !isSelected && (
                  <span className="absolute bottom-1 left-1 text-[8px] font-bold px-1 py-0.2 rounded bg-black/50 text-white backdrop-blur-xs leading-none">
                    {template.badge}
                  </span>
                )}

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
                    onToggleFavorite(template.id);
                  }}
                  className="absolute top-1 right-1 p-0.5 rounded-full hover:bg-black/30 text-white/80 hover:text-white"
                  title="Bookmark look"
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

                {/* Actions for user custom templates: Rename, Duplicate, Delete */}
                {template.isCustom && (
                  <div className="absolute bottom-1 right-1 flex items-center gap-0.5">
                    <button
                      onClick={(e) => handleRenameCustomTemplate(template, e)}
                      className="p-1 rounded-full bg-black/60 hover:bg-[#8B5CF6] text-white active:scale-95 transition-all cursor-pointer"
                      title="Rename custom look"
                    >
                      <span className="material-symbols-outlined text-[10px]">edit</span>
                    </button>
                    <button
                      onClick={(e) => handleDuplicateCustomTemplate(template, e)}
                      className="p-1 rounded-full bg-black/60 hover:bg-[#8B5CF6] text-white active:scale-95 transition-all cursor-pointer"
                      title="Duplicate custom look"
                    >
                      <span className="material-symbols-outlined text-[10px]">content_copy</span>
                    </button>
                    <button
                      onClick={(e) => handleDeleteCustomTemplate(template.id, e)}
                      className="p-1 rounded-full bg-black/60 hover:bg-error text-white active:scale-95 transition-all cursor-pointer"
                      title="Delete custom look"
                    >
                      <span className="material-symbols-outlined text-[10px]">delete</span>
                    </button>
                  </div>
                )}
              </div>

              <span
                className={`text-[10px] truncate max-w-[64px] text-center font-medium ${
                  isSelected
                    ? 'text-primary font-bold'
                    : 'text-on-surface-variant group-hover:text-on-surface'
                }`}
              >
                {template.name}
              </span>
            </div>
          );
        })}

        {/* Empty state within strip */}
        {filteredTemplates.length === 0 && (
          <div className="flex items-center justify-center p-3 text-[11px] text-outline bg-surface-container-low rounded-xl border border-outline-variant w-full">
            <span>No matching templates found.</span>
          </div>
        )}
      </div>

      {/* Save Custom Template Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-surface-container-low border border-outline-variant rounded-2xl p-4 shadow-2xl flex flex-col gap-3 text-on-surface">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2">
              <h3 className="font-bold text-[14px] text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  bookmark_add
                </span>
                <span>Save Custom Look</span>
              </h3>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-outline hover:text-on-surface p-1"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveCustomTemplate} className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1">
                  Look Name
                </label>
                <input
                  type="text"
                  required
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g. My Golden Film"
                  className="w-full h-8 px-2.5 text-[12px] rounded-lg bg-surface-container-lowest border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1">
                  Category
                </label>
                <select
                  value={newTemplateCategory}
                  onChange={(e) => setNewTemplateCategory(e.target.value as TemplateCategory)}
                  className="w-full h-8 px-2 text-[12px] rounded-lg bg-surface-container-lowest border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
                >
                  {TEMPLATE_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-outline hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-[11px] font-bold bg-primary text-white hover:bg-primary-container shadow-xs"
                >
                  Save Look
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cloud AI Privacy & Data Protection Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface-container-low border border-outline-variant rounded-2xl p-4 shadow-2xl flex flex-col gap-3 text-on-surface">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2">
              <h3 className="font-bold text-[14px] text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">cloud</span>
                <span>Cloud AI Vision Recommendation</span>
              </h3>
              <button
                onClick={() => setShowConsentModal(false)}
                className="text-outline hover:text-on-surface p-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2 text-[11px] text-on-surface-variant leading-relaxed">
              <p>
                Cloud AI Vision evaluates your photo using a secure Supabase Edge Function to analyze aesthetic style, lighting, and genre composition for tailored preset curation.
              </p>
              <div className="bg-surface-container-lowest p-2.5 rounded-lg border border-outline-variant flex flex-col gap-1 text-[10px]">
                <div className="flex items-center gap-1 text-on-surface font-semibold">
                  <span className="material-symbols-outlined text-emerald-400 text-[14px]">shield</span>
                  <span>Privacy & Data Protection Notice:</span>
                </div>
                <ul className="list-disc pl-4 text-outline space-y-0.5">
                  <li>Analysis is ephemeral in-memory; photos are never stored on any remote disk.</li>
                  <li>Your photographs are never used for AI model training or analytics tracking.</li>
                  <li>Zero personal identity or tracking identifiers are collected or shared.</li>
                </ul>
              </div>
              <p className="text-[10px] text-outline">
                Prefer 100% offline, zero-network analysis? You can use <strong>Analytical Smart Match</strong>, which executes entirely on your device in under 10ms.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
              <label className="flex items-center gap-1.5 text-[10px] text-outline cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="rememberConsent"
                  className="rounded border-outline-variant text-primary focus:ring-0 cursor-pointer"
                />
                <span>Remember choice</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowConsentModal(false)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-outline hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('rememberConsent') as HTMLInputElement | null;
                    handleConsentAndProceed(!!el?.checked);
                  }}
                  className="px-4 py-1.5 rounded-lg text-[11px] font-bold bg-primary text-white hover:bg-primary-container shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">check</span>
                  <span>I Agree & Proceed</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
