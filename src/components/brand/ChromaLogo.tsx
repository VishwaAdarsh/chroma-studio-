import React from 'react';

export interface ChromaLogoProps {
  variant?: 'icon' | 'wordmark' | 'header' | 'auth';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showTagline?: boolean;
}

export const ChromaLogo: React.FC<ChromaLogoProps> = ({
  variant = 'header',
  size = 'md',
  className = '',
  showTagline = true,
}) => {
  const iconPixelSize = {
    sm: 26,
    md: 34,
    lg: 48,
    xl: 68,
  }[size];

  // The Official Colorful 'C' Symbol Emblem with Viewfinder Brackets & Star Sparkle
  const LogoSymbol = (
    <div
      className="relative shrink-0 flex items-center justify-center select-none"
      style={{ width: iconPixelSize, height: iconPixelSize }}
    >
      <img
        src="/brand/chroma-logo-symbol-transparent.png"
        alt="Chroma Studio Emblem"
        width={iconPixelSize}
        height={iconPixelSize}
        className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(124,58,237,0.35)] transition-transform duration-300 hover:scale-105"
        onError={(e) => {
          // If asset path fails in an unusual environment, fall back to SVG mark
          const target = e.currentTarget;
          target.onerror = null;
          target.src = '/brand/favicon.svg';
        }}
      />
    </div>
  );

  // 1. Icon-Only Variant
  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`} role="img" aria-label="Chroma Studio Icon">
        {LogoSymbol}
      </div>
    );
  }

  // 2. Header Variant (Topbar / Navbar)
  if (variant === 'header') {
    return (
      <div className={`flex items-center gap-2.5 cursor-pointer select-none group ${className}`}>
        {LogoSymbol}
        <div className="flex flex-col justify-center leading-none">
          <div className="flex items-baseline tracking-tight font-black text-white text-[17px] sm:text-[18px]">
            <span>CHROM</span>
            <span className="bg-gradient-to-tr from-[#2563FF] via-[#7C3AED] to-[#D946EF] bg-clip-text text-transparent">
              A
            </span>
            <span className="text-[10px] font-bold tracking-[0.25em] text-[#94A3B8] ml-2 uppercase opacity-90 hidden xs:inline">
              STUDIO
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 3. Auth Modal / Hero Variant
  if (variant === 'auth') {
    return (
      <div className={`flex flex-col items-center text-center gap-3.5 select-none ${className}`}>
        <div className="relative p-2.5 rounded-3xl bg-[#09070A] border border-white/10 shadow-2xl shadow-purple-950/40">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-[#00E5FF]/20 via-[#7C3AED]/25 to-[#FF9A3C]/20 blur-md pointer-events-none" />
          <img
            src="/brand/chroma-logo-symbol-transparent.png"
            alt="Chroma Studio Logo"
            className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_16px_rgba(0,229,255,0.4)]"
            onError={(e) => {
              const target = e.currentTarget;
              target.onerror = null;
              target.src = '/brand/favicon.svg';
            }}
          />
        </div>
        <div className="flex flex-col items-center">
          <h2 className="font-black text-2xl sm:text-3xl tracking-tight text-white flex items-center">
            <span>CHROM</span>
            <span className="bg-gradient-to-tr from-[#2563FF] via-[#7C3AED] to-[#D946EF] bg-clip-text text-transparent">
              A
            </span>
            <span className="text-[13px] font-bold tracking-[0.3em] text-[#94A3B8] ml-2.5 uppercase">
              STUDIO
            </span>
          </h2>
          {showTagline && (
            <p className="text-[11px] font-semibold tracking-[0.22em] text-[#94A3B8] uppercase mt-1">
              Create • Edit • Design • Inspire
            </p>
          )}
        </div>
      </div>
    );
  }

  // 4. Default Horizontal Wordmark
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {LogoSymbol}
      <div className="flex flex-col justify-center">
        <div className="flex items-baseline tracking-tight font-black text-white text-[19px] sm:text-[21px]">
          <span>CHROM</span>
          <span className="bg-gradient-to-tr from-[#2563FF] via-[#7C3AED] to-[#D946EF] bg-clip-text text-transparent">
            A
          </span>
          <span className="text-[11px] font-bold tracking-[0.28em] text-[#94A3B8] ml-2.5 uppercase">
            STUDIO
          </span>
        </div>
        {showTagline && (
          <span className="text-[9px] font-bold tracking-[0.2em] text-[#94A3B8] uppercase mt-0.5">
            Create • Edit • Design • Inspire
          </span>
        )}
      </div>
    </div>
  );
};
