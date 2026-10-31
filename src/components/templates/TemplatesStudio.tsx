import React, { useState } from 'react';
import { READY_MADE_TEMPLATES, TEMPLATE_CATEGORIES } from '../../data/templatesData';
import { StorageService } from '../../services/storage';
import { ReadyMadeTemplate, TemplateStudioCategory } from '../../types/design';
import { useAuth } from '../../contexts/AuthContext';

interface TemplatesStudioProps {
  onBack: () => void;
  onSelectTemplate: (template: ReadyMadeTemplate) => void;
}

export const TemplatesStudio: React.FC<TemplatesStudioProps> = ({
  onBack,
  onSelectTemplate,
}) => {
  const { requireAuth } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<TemplateStudioCategory>('All Templates');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<ReadyMadeTemplate | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const favs = localStorage.getItem('chroma_template_favorites');
      return favs ? JSON.parse(favs) : ['tmpl-minimal-editorial', 'tmpl-vogue-portrait'];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id];
    setFavorites(updated);
    try {
      localStorage.setItem('chroma_template_favorites', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Filter templates
  const filteredTemplates = READY_MADE_TEMPLATES.filter((tmpl) => {
    const matchesCategory =
      selectedCategory === 'All Templates' ||
      tmpl.category === selectedCategory ||
      (selectedCategory === 'Instagram Posts' && tmpl.width === tmpl.height) ||
      (selectedCategory === 'Instagram Stories' && tmpl.height > tmpl.width * 1.5);

    const matchesSearch =
      !searchQuery.trim() ||
      tmpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tmpl.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      tmpl.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col justify-between selection:bg-primary-container selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl border-b border-outline-variant shadow-xs">
        <div className="h-14 px-4 flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors border border-outline-variant cursor-pointer"
              title="Back"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">dashboard_customize</span>
              <h1 className="text-[16px] font-extrabold tracking-tight text-on-surface">
                TEMPLATES STUDIO
              </h1>
              <span className="text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full uppercase">
                READY-MADE
              </span>
            </div>
          </div>

          <div className="text-[11px] font-mono text-outline">
            {filteredTemplates.length} Designs
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-4 flex flex-col gap-4">
        {/* Search Bar */}
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search templates by style, format, or theme..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container-low border border-outline-variant text-[13px] text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {/* 20 Categories Horizontal Scroll Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {TEMPLATE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-primary-container text-white shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high border border-outline-variant'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid of Ready-Made Template Cards */}
        {filteredTemplates.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-outline gap-2 bg-surface-container-lowest rounded-2xl border border-outline-variant">
            <span className="material-symbols-outlined text-[36px] text-primary">search_off</span>
            <h3 className="text-[14px] font-bold text-on-surface">No templates found</h3>
            <p className="text-[11px]">Try adjusting your search query or choosing another category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredTemplates.map((template) => {
              const isFav = favorites.includes(template.id);
              const isStory = template.height > template.width * 1.5;

              return (
                <div
                  key={template.id}
                  onClick={() => setPreviewTemplate(template)}
                  className="rounded-2xl bg-surface-container-lowest border border-outline-variant overflow-hidden flex flex-col shadow-xs group cursor-pointer hover:border-primary transition-all active:scale-[0.99]"
                >
                  {/* Template Visual Thumbnail Canvas */}
                  <div
                    className={`relative w-full overflow-hidden flex items-center justify-center ${
                      isStory ? 'aspect-[9/16]' : 'aspect-square'
                    }`}
                    style={{
                      background:
                        template.background.type === 'color'
                          ? template.background.value
                          : template.background.type === 'gradient'
                          ? template.background.value
                          : '#fff8f7',
                    }}
                  >
                    {/* Simulated miniature layout preview */}
                    <div className="w-[85%] h-[85%] rounded-lg border border-black/10 overflow-hidden relative shadow-sm flex flex-col justify-between p-2">
                      {template.elements.find((e) => e.type === 'image') && (
                        <div className="w-full flex-1 rounded bg-surface-container-high overflow-hidden relative mb-1">
                          <img
                            src={(template.elements.find((e) => e.type === 'image') as any)?.src}
                            alt="Mock preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="h-6 flex items-center justify-between">
                        <span className="text-[9px] font-bold text-on-surface truncate">
                          {template.elements.find((e) => e.type === 'text')
                            ? (template.elements.find((e) => e.type === 'text') as any).text
                            : template.name}
                        </span>
                      </div>
                    </div>

                    {/* Format Badge */}
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-surface-container-lowest/90 backdrop-blur-md text-primary font-mono text-[9px] font-bold border border-outline-variant">
                      {template.width}×{template.height}
                    </span>

                    {/* Favorite Heart Button */}
                    <button
                      onClick={(e) => toggleFavorite(template.id, e)}
                      className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        isFav
                          ? 'bg-primary text-white'
                          : 'bg-surface-container-lowest/80 text-outline hover:text-primary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {isFav ? 'favorite' : 'favorite_border'}
                      </span>
                    </button>
                  </div>

                  {/* Card Meta */}
                  <div className="p-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        {template.category}
                      </span>
                      <span className="text-[9px] font-mono text-outline">
                        {template.elements.filter((e) => e.type === 'image').length} Photos
                      </span>
                    </div>
                    <h3 className="text-[13px] font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                      {template.name}
                    </h3>
                    <p className="text-[10px] text-on-surface-variant line-clamp-2 leading-relaxed">
                      {template.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Detailed Template Preview & Customization Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-outline-variant max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-outline-variant flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-on-surface">
                  {previewTemplate.name}
                </h3>
                <span className="text-[11px] font-mono text-primary font-semibold">
                  {previewTemplate.width} × {previewTemplate.height}px • {previewTemplate.category}
                </span>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="w-8 h-8 rounded-full bg-surface-container-low hover:bg-surface-container-high flex items-center justify-center text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              <div
                className="w-full rounded-xl overflow-hidden flex items-center justify-center p-6 border border-outline-variant shadow-inner"
                style={{
                  background:
                    previewTemplate.background.type === 'color'
                      ? previewTemplate.background.value
                      : previewTemplate.background.value,
                }}
              >
                <div className="w-56 aspect-[4/5] rounded-lg shadow-xl overflow-hidden bg-white/90 p-3 flex flex-col justify-between">
                  {previewTemplate.elements.find((e) => e.type === 'image') && (
                    <img
                      src={(previewTemplate.elements.find((e) => e.type === 'image') as any).src}
                      alt="Preview"
                      className="w-full h-36 object-cover rounded"
                    />
                  )}
                  <span className="text-[11px] font-bold text-on-surface truncate pt-2">
                    {previewTemplate.name}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-[12px] font-bold text-on-surface uppercase tracking-wider mb-1">
                  Design Summary
                </h4>
                <p className="text-[12px] text-on-surface-variant leading-relaxed">
                  {previewTemplate.description}
                </p>
              </div>

              {/* Replaceable Slots info */}
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    add_photo_alternate
                  </span>
                  <div>
                    <span className="text-[11px] font-bold text-on-surface block">
                      {previewTemplate.elements.filter((e) => e.type === 'image').length} Replaceable Photo Slots
                    </span>
                    <span className="text-[9px] text-outline">
                      Select your photos to instantly customize this design
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-primary font-mono">1-Tap Replace</span>
              </div>
            </div>

            {/* Modal Footer with Customize Action */}
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-end gap-2">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-outline hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const tmpl = previewTemplate;
                  setPreviewTemplate(null);
                  requireAuth(
                    { type: 'template-edit', template: tmpl },
                    () => onSelectTemplate(tmpl),
                    `Sign in to customize "${tmpl.name}"`
                  );
                }}
                className="px-5 py-2 rounded-xl bg-primary text-white text-[12px] font-bold shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">palette</span>
                <span>Customize Design</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
