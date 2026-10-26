import React, { useMemo, useState } from 'react';
import { TEMPLATE_CATEGORIES, TEMPLATES } from '../../data/presets';
import { StorageService } from '../../services/storage';
import type {
  AdjustmentParameters,
  ColorWheels,
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
}) => {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<PhotoTemplate[]>(() =>
    StorageService.getCustomTemplates()
  );

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

                {/* Delete button for user custom templates */}
                {template.isCustom && (
                  <button
                    onClick={(e) => handleDeleteCustomTemplate(template.id, e)}
                    className="absolute bottom-1 right-1 p-0.5 rounded-full bg-black/40 hover:bg-error text-white"
                    title="Delete custom look"
                  >
                    <span className="material-symbols-outlined text-[11px]">delete</span>
                  </button>
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
    </div>
  );
};
