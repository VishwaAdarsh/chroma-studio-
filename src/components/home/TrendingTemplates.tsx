import React from 'react';
import type { ReadyMadeTemplate } from '../../types/design';
import { READY_MADE_TEMPLATES } from '../../data/templatesData';

interface TrendingTemplatesProps {
  onSelectTemplate: (template: ReadyMadeTemplate) => void;
  onViewAll: () => void;
  searchFilter?: string;
}

export const TrendingTemplates: React.FC<TrendingTemplatesProps> = ({
  onSelectTemplate,
  onViewAll,
  searchFilter = '',
}) => {
  // Pre-configured trending items matching the reference screenshot categories & visual styles
  const trendingItems = [
    {
      id: 'tmpl-ig-post',
      category: 'Instagram Post',
      title: 'Fashion Portrait',
      imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      gradient: 'from-purple-900 to-indigo-900',
    },
    {
      id: 'tmpl-ig-story',
      category: 'Instagram Story',
      title: 'Aesthetic Moodboard',
      imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
      gradient: 'from-amber-900 to-stone-900',
    },
    {
      id: 'tmpl-birthday',
      category: 'Birthday',
      title: 'Celebrate Joy',
      imageUrl: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=600&q=80',
      gradient: 'from-pink-900 to-rose-900',
    },
    {
      id: 'tmpl-travel',
      category: 'Travel',
      title: 'Explore the World',
      imageUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80',
      gradient: 'from-cyan-900 to-blue-900',
    },
    {
      id: 'tmpl-minimal',
      category: 'Minimal',
      title: 'Clean Silhouette',
      imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
      gradient: 'from-neutral-900 to-zinc-900',
    },
    {
      id: 'tmpl-aesthetic',
      category: 'Aesthetic',
      title: 'Vintage Collage',
      imageUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
      gradient: 'from-rose-950 to-amber-950',
    },
    {
      id: 'tmpl-business',
      category: 'Business',
      title: 'Work & Pitch Deck',
      imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80',
      gradient: 'from-slate-900 to-cyan-950',
    },
    {
      id: 'tmpl-festival',
      category: 'Festival',
      title: 'Festive Lights',
      imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
      gradient: 'from-orange-950 to-red-950',
    },
    {
      id: 'tmpl-quotes',
      category: 'Quotes',
      title: 'Daily Inspiration',
      imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=600&q=80',
      gradient: 'from-violet-950 to-pink-950',
    },
  ];

  const filtered = trendingItems.filter((item) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      item.category.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q)
    );
  });

  const handleCardClick = (item: (typeof trendingItems)[0]) => {
    // Find matching ready made template or fallback to first template
    const match =
      READY_MADE_TEMPLATES.find((t) => t.category.toLowerCase().includes(item.category.toLowerCase())) ||
      READY_MADE_TEMPLATES[0];
    onSelectTemplate(match);
  };

  return (
    <div className="flex flex-col gap-3.5 w-full">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <span>Trending Templates</span>
        </h2>
        <button
          onClick={onViewAll}
          className="text-[13px] font-semibold text-[#8B5CF6] hover:text-[#A855F7] flex items-center gap-1 py-1 transition-colors cursor-pointer group min-h-[36px]"
        >
          <span>View All</span>
          <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">
            arrow_forward
          </span>
        </button>
      </div>

      {/* Horizontal Carousel */}
      <div className="flex items-center gap-3.5 overflow-x-auto pb-2 pt-1 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 touch-scroll-x touch-pan-x">
        {filtered.map((item) => (
          <button
            key={item.id}
            onClick={() => handleCardClick(item)}
            className="group flex flex-col items-center gap-2 shrink-0 cursor-pointer text-left focus:outline-none"
            style={{ width: '136px' }}
          >
            {/* Template Card Visual */}
            <div className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden bg-[#131B2E] border border-white/10 group-hover:border-[#8B5CF6]/50 shadow-md shadow-black/30 group-hover:shadow-purple-900/20 transition-all duration-300 group-hover:scale-[1.03] active:scale-95">
              <img
                src={item.imageUrl}
                alt={item.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  // Fallback gradient if remote image is offline
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              {/* Fallback & Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

              {/* Tag / Category Badge on Card */}
              <div className="absolute bottom-2.5 inset-x-2 text-center pointer-events-none">
                <span className="text-[11px] font-bold text-white drop-shadow-md truncate block">
                  {item.title}
                </span>
              </div>
            </div>

            {/* Category Title Below Thumbnail */}
            <span className="text-[12px] font-medium text-[#CBD5E1] group-hover:text-white transition-colors text-center truncate w-full">
              {item.category}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
