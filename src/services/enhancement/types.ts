// Chroma Studio — AI Image Enhancement Types

import type { AdjustmentParameters } from '../../types/editor';

export type EnhancementStrength = 'subtle' | 'balanced' | 'strong';
export type EnhancementMode = 'ai-local' | 'ai-cloud' | 'analytical';

export interface EnhancementMetrics {
  dynamicRange: number;
  medianLuminance: number;
  noiseFloor: number;
  skinToneCoverage: number;
  colorCast: string;
}

export interface EnhancementOptions {
  strength?: EnhancementStrength;
  mode?: EnhancementMode;
  userConsent?: boolean;
  signal?: AbortSignal;
  onProgress?: (percent: number, status: string) => void;
}

export interface EnhancementResult {
  parameters: Partial<AdjustmentParameters>;
  strength: EnhancementStrength;
  mode: EnhancementMode;
  explanation: string;
  durationMs: number;
  confidence: number;
  metrics: EnhancementMetrics;
}

export interface EnhancementEngine {
  enhance(
    source:
      | ImageData
      | HTMLImageElement
      | HTMLCanvasElement
      | { data: Uint8ClampedArray; width: number; height: number },
    currentAdjustments: AdjustmentParameters,
    options?: EnhancementOptions
  ): Promise<EnhancementResult>;
}
