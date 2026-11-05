// Chroma Studio — AI Background Replacement Types & Interfaces

export type BackgroundReplacementMode = 'color' | 'image' | 'ai';

export interface BackgroundTransform {
  scale: number;        // 0.5 to 2.5 (1 = 100%)
  offsetX: number;      // -50% to +50%
  offsetY: number;      // -50% to +50%
  fit: 'cover' | 'contain' | 'fill';
  blur: number;         // 0 to 20 px simulated depth-of-field blur
}

export interface ForegroundTransform {
  scale: number;        // 0.5 to 1.5 (1 = 100%)
  offsetX: number;      // -50% to +50%
  offsetY: number;      // -50% to +50%
}

export interface BackgroundReplacementState {
  enabled: boolean;
  mode: BackgroundReplacementMode;
  color: string;                     // Hex color e.g. '#FFFFFF'
  imageSrc?: string;                 // Custom uploaded image (Data URL / Object URL)
  imageName?: string;
  aiPrompt?: string;                 // Text prompt for generative background
  aiGeneratedSrc?: string;           // Resulting image URL / Data URL from AI generation
  aiProvider?: 'cloud' | 'local-synth';
  hasUserConsent?: boolean;
  bgTransform: BackgroundTransform;
  fgTransform: ForegroundTransform;
  feather: number;                   // 0 to 10 px edge blending
  updatedAt?: number;
}

export interface AiBackgroundOptions {
  prompt: string;
  stylePreset?: string;
  width?: number;
  height?: number;
  userConsent?: boolean;
  signal?: AbortSignal;
  onProgress?: (percent: number, status: string) => void;
}

export interface AiBackgroundResult {
  imageUrl: string;
  prompt: string;
  provider: 'cloud' | 'local-synth';
  durationMs: number;
  explanation?: string;
}

export interface BackgroundGeneratorEngine {
  generateBackground(options: AiBackgroundOptions): Promise<AiBackgroundResult>;
}
