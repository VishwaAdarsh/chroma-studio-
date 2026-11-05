import React from 'react';

interface WorkspaceCardsProps {
  onOpenEditor: () => void;
  onOpenTemplates: () => void;
  onOpenCollage: () => void;
  onOpenCarousel: () => void;
  onOpenAiImageGen?: () => void;
}

export const WorkspaceCards: React.FC<WorkspaceCardsProps> = ({
  onOpenEditor,
  onOpenTemplates,
  onOpenCollage,
  onOpenCarousel,
  onOpenAiImageGen,
}) => {
  const cards = [
    {
      id: 'card-editor',
      title: 'Photo Editor',
      description: 'Professional editing tools',
      icon: 'auto_fix_high',
      iconGradient: 'from-[#EC4899] to-[#8B5CF6]',
      onClick: onOpenEditor,
    },
    {
      id: 'card-ai-gen',
      title: 'AI Generator',
      description: 'Text to image studio',
      icon: 'auto_awesome',
      iconGradient: 'from-[#8B5CF6] to-[#EC4899]',
      onClick: onOpenAiImageGen || onOpenEditor,
      badge: 'AI',
    },
    {
      id: 'card-templates',
      title: 'Templates',
      description: 'Ready-made designs',
      icon: 'dashboard_customize',
      iconGradient: 'from-[#F59E0B] to-[#EA580C]',
      onClick: onOpenTemplates,
    },
    {
      id: 'card-collage',
      title: 'Collage',
      description: 'Beautiful photo layouts',
      icon: 'grid_view',
      iconGradient: 'from-[#06B6D4] to-[#3B82F6]',
      onClick: onOpenCollage,
    },
    {
      id: 'card-carousel',
      title: 'Carousel',
      description: 'Create stunning carousels',
      icon: 'view_carousel',
      iconGradient: 'from-[#8B5CF6] to-[#6366F1]',
      onClick: onOpenCarousel,
    },
  ];

  return (
    <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3.5 w-full">
      {cards.map((card) => (
        <button
          key={card.id}
          onClick={card.onClick}
          className="group relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-[#111827]/80 hover:bg-[#172033] border border-white/10 hover:border-white/20 shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-200 active:scale-[0.98] text-left cursor-pointer overflow-hidden touch-manipulation"
        >
          {/* Subtle Ambient Hover Glow */}
          <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-white/[0.03] group-hover:bg-[#8B5CF6]/10 blur-xl transition-all duration-300 pointer-events-none" />

          <div className="flex items-center gap-3.5 min-w-0">
            {/* Gradient Icon Box */}
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.iconGradient} flex items-center justify-center shrink-0 shadow-md shadow-black/30 group-hover:scale-105 transition-transform duration-200`}
            >
              <span className="material-symbols-outlined text-[24px] text-white">
                {card.icon}
              </span>
            </div>

            {/* Title & Description */}
            <div className="flex flex-col min-w-0">
              <h3 className="font-bold text-[15px] text-white tracking-tight truncate">
                {card.title}
              </h3>
              <p className="text-[12px] text-[#94A3B8] group-hover:text-[#CBD5E1] transition-colors truncate">
                {card.description}
              </p>
            </div>
          </div>

          {/* Circular Navigation Arrow */}
          <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-white/10 border border-white/10 flex items-center justify-center shrink-0 ml-2 transition-all">
            <span className="material-symbols-outlined text-[16px] text-[#94A3B8] group-hover:text-white group-hover:translate-x-0.5 transition-all">
              arrow_forward_ios
            </span>
          </div>
        </button>
      ))}
    </div>
  );
};
