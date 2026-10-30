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
  const iconDimensions = {
    sm: { box: 26, radius: 7 },
    md: { box: 34, radius: 9 },
    lg: { box: 44, radius: 12 },
    xl: { box: 60, radius: 16 },
  }[size];

  // Stylized Prismatic Delta Aperture Emblem matching reference screenshot
  const LogoIcon = (
    <svg
      viewBox="0 0 100 100"
      width={iconDimensions.box}
      height={iconDimensions.box}
      fill="none"
      className="shrink-0 transition-transform duration-300 hover:scale-105"
      role="img"
      aria-label="Chroma Studio Logo"
    >
      <defs>
        <linearGradient id="prism-grad-main" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="35%" stopColor="#8B5CF6" />
          <stop offset="70%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id="prism-grad-top" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id="prism-grad-inner" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>

      {/* Prismatic Rounded Aperture Polygon */}
      <path
        d="M 50 12 C 54 12 57 14 59 18 L 86 66 C 88 70 88 74 86 78 C 84 82 80 84 76 84 L 24 84 C 20 84 16 82 14 78 C 12 74 12 70 14 66 L 41 18 C 43 14 46 12 50 12 Z"
        fill="url(#prism-grad-main)"
      />
      {/* Dynamic Inner Aperture Iris Blades */}
      <path
        d="M 50 24 L 74 72 L 40 72 Z"
        fill="#070B14"
        opacity="0.9"
      />
      <path
        d="M 50 30 L 68 68 L 44 68 Z"
        fill="url(#prism-grad-inner)"
        opacity="0.95"
      />
      <circle cx="51" cy="54" r="5.5" fill="#FFFFFF" opacity="0.95" />
    </svg>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{LogoIcon}</div>;
  }

  if (variant === 'header') {
    return (
      <div className={`flex items-center gap-2.5 cursor-pointer ${className}`}>
        {LogoIcon}
        <div className="flex items-center gap-1.5 leading-none">
          <span className="font-extrabold text-[17px] tracking-tight text-white font-sans">
            Chroma Studio
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'auth') {
    return (
      <div className={`flex flex-col items-center text-center gap-3 ${className}`}>
        <div className="p-1 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-xl shadow-purple-950/40">
          <svg
            viewBox="0 0 100 100"
            width={64}
            height={64}
            fill="none"
            className="rounded-[14px]"
            role="img"
            aria-label="Chroma Studio Emblem"
          >
            <rect width="100" height="100" rx="14" fill="#070B14" />
            <path
              d="M 50 12 C 54 12 57 14 59 18 L 86 66 C 88 70 88 74 86 78 C 84 82 80 84 76 84 L 24 84 C 20 84 16 82 14 78 C 12 74 12 70 14 66 L 41 18 C 43 14 46 12 50 12 Z"
              fill="url(#prism-grad-main)"
            />
            <path d="M 50 24 L 74 72 L 40 72 Z" fill="#070B14" opacity="0.9" />
            <path d="M 50 30 L 68 68 L 44 68 Z" fill="url(#prism-grad-inner)" opacity="0.95" />
            <circle cx="51" cy="54" r="5.5" fill="#FFFFFF" opacity="0.95" />
          </svg>
        </div>
        <div className="flex flex-col items-center">
          <h2 className="font-black text-2xl tracking-tight text-white">Chroma Studio</h2>
          {showTagline && (
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#94A3B8] uppercase mt-1">
              Create • Edit • Design • Inspire
            </p>
          )}
        </div>
      </div>
    );
  }

  // Wordmark horizontal default
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {LogoIcon}
      <div className="flex flex-col">
        <span className="font-black text-xl tracking-tight text-white">Chroma Studio</span>
        {showTagline && (
          <span className="text-[9px] font-bold tracking-[0.2em] text-[#94A3B8] uppercase mt-0.5">
            Create • Edit • Design • Inspire
          </span>
        )}
      </div>
    </div>
  );
};
