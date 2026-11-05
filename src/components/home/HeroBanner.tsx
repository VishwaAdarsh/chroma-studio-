import React from 'react';

interface HeroBannerProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearchSubmit) {
      onSearchSubmit();
    }
  };

  return (
    <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl border border-white/10 min-h-[210px] sm:min-h-[260px] md:min-h-[290px] flex flex-col justify-end p-4 sm:p-7 md:p-8 bg-cover bg-center transition-all duration-300"
      style={{
        backgroundImage: `url('/assets/hero-mountains.svg')`,
      }}
    >
      {/* Deep Alpenglow Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-[#070B14]/60 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#070B14]/80 via-transparent to-transparent pointer-events-none" />

      {/* Hero Typography & Search */}
      <div className="relative z-10 flex flex-col gap-2.5 sm:gap-3 max-w-2xl">
        <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-md leading-tight">
          Create. Edit. Design. Inspire.
        </h1>
        <p className="text-[12px] sm:text-base text-[#CBD5E1] font-normal leading-relaxed drop-shadow-sm max-w-xl">
          All-in-one photo editing, templates, collage and carousel creator.
        </p>

        {/* Hero Search Field */}
        <div className="mt-1 sm:mt-2 relative w-full max-w-lg">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[#94A3B8] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search templates, tools, or projects..."
            className="w-full h-11 sm:h-12 pl-11 pr-4 rounded-2xl bg-[#0B1220]/75 backdrop-blur-xl border border-white/15 text-white placeholder-[#94A3B8] text-[13px] sm:text-[14px] focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/30 shadow-lg shadow-black/40 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-[#CBD5E1] flex items-center justify-center text-[14px] transition-colors"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
