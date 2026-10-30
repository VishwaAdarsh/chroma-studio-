import React, { useState } from 'react';
import { CAROUSEL_FAMILIES, CarouselFamilyDefinition } from '../../data/carouselTemplates';
import { CarouselFormat } from '../../types/design';

interface CarouselStudioProps {
  onBack: () => void;
  onSelectCarousel: (family: CarouselFamilyDefinition) => void;
}

export const CarouselStudio: React.FC<CarouselStudioProps> = ({
  onBack,
  onSelectCarousel,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<CarouselFormat | 'all'>('all');

  const filteredFamilies = CAROUSEL_FAMILIES.filter(
    (f) => selectedFormat === 'all' || f.format === selectedFormat
  );

  return (
    <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col justify-between selection:bg-primary-container selection:text-white">
      {/* Header */}
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl border-b border-outline-variant shadow-xs">
        <div className="h-14 px-4 flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors border border-outline-variant cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">view_carousel</span>
              <h1 className="text-[16px] font-extrabold tracking-tight text-on-surface">
                CAROUSEL STUDIO
              </h1>
              <span className="text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full uppercase">
                MULTI-SLIDE
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-5 flex flex-col gap-6">
        {/* Hero banner */}
        <div className="w-full rounded-2xl bg-gradient-to-br from-surface-container-highest via-surface-container to-surface-container-low border border-outline-variant p-5 shadow-sm flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary font-mono">
            COORDINATED SOCIAL SEQUENCES
          </span>
          <h2 className="text-[20px] font-bold text-on-surface">
            Create Engaging Instagram Carousels
          </h2>
          <p className="text-[12px] text-on-surface-variant max-w-lg leading-relaxed">
            Multi-slide designs with unified typography, slide management, batch photo filling, and sequential upload-ready exports.
          </p>

          {/* Format Filter Chips */}
          <div className="flex gap-2 pt-2">
            {[
              { id: 'all', label: 'All Formats' },
              { id: '4:5', label: 'Instagram 4:5 Portrait' },
              { id: '1:1', label: 'Square 1:1 Post' },
              { id: '9:16', label: 'Stories 9:16' },
            ].map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => setSelectedFormat(fmt.id as any)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedFormat === fmt.id
                    ? 'bg-primary-container text-white shadow-xs'
                    : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant hover:bg-surface-container-high'
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Carousel Templates List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredFamilies.map((family) => (
            <div
              key={family.id}
              onClick={() => onSelectCarousel(family)}
              className="rounded-2xl bg-surface-container-lowest border border-outline-variant overflow-hidden flex flex-col p-4 gap-3 cursor-pointer hover:border-primary transition-all shadow-xs group"
            >
              {/* Mini Slide Strip preview */}
              <div className="w-full h-36 bg-surface-container-low rounded-xl border border-outline-variant p-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
                {family.slides.map((s, idx) => (
                  <div
                    key={s.id}
                    className="flex-shrink-0 w-24 h-full rounded-lg bg-surface-container-highest border border-outline-variant overflow-hidden p-1.5 flex flex-col justify-between"
                  >
                    <span className="text-[8px] font-mono font-bold text-primary">#{idx + 1}</span>
                    <span className="text-[8px] font-semibold text-on-surface truncate">
                      {s.title}
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-primary uppercase">
                    {family.category} • {family.format}
                  </span>
                  <span className="text-[10px] font-mono text-outline">
                    {family.slides.length} Slides
                  </span>
                </div>
                <h3 className="text-[14px] font-bold text-on-surface group-hover:text-primary transition-colors">
                  {family.name}
                </h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2">
                  {family.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};
