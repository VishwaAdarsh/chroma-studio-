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
  // Determine icon dimensions based on size
  const iconDimensions = {
    sm: { box: 28, radius: 7 },
    md: { box: 36, radius: 10 },
    lg: { box: 48, radius: 14 },
    xl: { box: 64, radius: 18 },
  }[size];

  // SVG Stylized C Aperture Icon
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
        <linearGradient id="cl-grad-primary" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="25%" stopColor="#A855F7" />
          <stop offset="50%" stopColor="#EC4899" />
          <stop offset="75%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id="cl-grad-warm" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EC4899" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id="cl-grad-accent" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="60%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>

      <rect width="100" height="100" rx={iconDimensions.radius * 2.2} fill="#0B0C10" />

      <g transform="translate(50, 50)">
        {/* Aperture Iris Blade 1 */}
        <path
          d="M 0 -36 C 22 -36 36 -20 36 0 C 36 6 34 11 31 16 L 16 7 C 20 2 20 -4 16 -12 C 12 -20 4 -22 -6 -20 L -12 -34 C -8 -35 -4 -36 0 -36 Z"
          fill="url(#cl-grad-primary)"
        />
        {/* Main C-Shape Aperture Body */}
        <path
          d="M 0 -36 C -20 -36 -36 -20 -36 0 C -36 20 -20 36 0 36 C 14 36 26 28 32 17 L 18 10 C 14 17 6 22 -2 22 C -14 22 -22 14 -22 0 C -22 -14 -14 -22 -2 -22 C 2 -22 6 -20 9 -17 L 22 -27 C 16 -32 8 -36 0 -36 Z"
          fill="url(#cl-grad-primary)"
        />
        {/* Bottom Flare Blade */}
        <path
          d="M 0 36 C 16 36 28 26 34 12 L 20 6 C 16 14 8 20 -1 20 C -7 20 -12 16 -16 11 L -28 21 C -20 30 -10 36 0 36 Z"
          fill="url(#cl-grad-accent)"
        />
        {/* Inner Aperture Core */}
        <circle cx="-1" cy="0" r="7" fill="#0B0C10" />
        <circle cx="-1" cy="0" r="4.5" fill="url(#cl-grad-warm)" />
        <circle cx="-3" cy="-2" r="1.5" fill="#FFFFFF" opacity="0.9" />
      </g>
    </svg>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{LogoIcon}</div>;
  }

  if (variant === 'header') {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        {LogoIcon}
        <div className="flex items-center gap-1.5 leading-none">
          <span className="font-black text-[16px] tracking-tight text-on-surface">CHROMA</span>
          <span className="font-semibold text-[15px] tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
            STUDIO
          </span>
          <span className="ml-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-white uppercase tracking-wider">
            PRO
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'auth') {
    return (
      <div className={`flex flex-col items-center text-center gap-3 ${className}`}>
        <div className="p-1 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-500 shadow-xl shadow-purple-900/20">
          <svg
            viewBox="0 0 100 100"
            width={68}
            height={68}
            fill="none"
            className="rounded-[14px]"
            role="img"
            aria-label="Chroma Studio Emblem"
          >
            <rect width="100" height="100" rx="16" fill="#0B0C10" />
            <g transform="translate(50, 50)">
              <path
                d="M 0 -36 C 22 -36 36 -20 36 0 C 36 6 34 11 31 16 L 16 7 C 20 2 20 -4 16 -12 C 12 -20 4 -22 -6 -20 L -12 -34 C -8 -35 -4 -36 0 -36 Z"
                fill="url(#cl-grad-primary)"
              />
              <path
                d="M 0 -36 C -20 -36 -36 -20 -36 0 C -36 20 -20 36 0 36 C 14 36 26 28 32 17 L 18 10 C 14 17 6 22 -2 22 C -14 22 -22 14 -22 0 C -22 -14 -14 -22 -2 -22 C 2 -22 6 -20 9 -17 L 22 -27 C 16 -32 8 -36 0 -36 Z"
                fill="url(#cl-grad-primary)"
              />
              <path
                d="M 0 36 C 16 36 28 26 34 12 L 20 6 C 16 14 8 20 -1 20 C -7 20 -12 16 -16 11 L -28 21 C -20 30 -10 36 0 36 Z"
                fill="url(#cl-grad-accent)"
              />
              <circle cx="-1" cy="0" r="7" fill="#0B0C10" />
              <circle cx="-1" cy="0" r="4.5" fill="url(#cl-grad-warm)" />
              <circle cx="-3" cy="-2" r="1.5" fill="#FFFFFF" opacity="0.9" />
            </g>
          </svg>
        </div>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 leading-tight">
            <span className="font-black text-2xl tracking-tight text-on-surface">CHROMA</span>
            <span className="font-light text-2xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
              STUDIO
            </span>
          </div>
          {showTagline && (
            <p className="text-[11px] font-semibold tracking-[0.22em] text-on-surface-variant uppercase mt-1">
              Edit • Design • Create • Inspire
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
        <div className="flex items-center gap-1.5 leading-none">
          <span className="font-black text-xl tracking-tight text-on-surface">CHROMA</span>
          <span className="font-semibold text-xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
            STUDIO
          </span>
        </div>
        {showTagline && (
          <span className="text-[9px] font-bold tracking-[0.2em] text-on-surface-variant uppercase mt-1">
            Edit • Design • Create • Inspire
          </span>
        )}
      </div>
    </div>
  );
};
