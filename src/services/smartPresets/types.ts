// Chroma Studio — Smart Preset Types & Interfaces

import type { Preset } from '../../types/editor';

export interface ImageAnalysisMetrics {
  meanLuminance: number;           // 0 to 255
  contrast: number;                // 0 to 100
  dynamicRange: 'low' | 'normal' | 'high';
  colorTemperature: 'warm' | 'cool' | 'neutral';
  saturationScore: number;         // 0 to 100
  isLowKey: boolean;               // Moody / dark scene dominant
  isHighKey: boolean;              // Bright / airy scene dominant
  isPortraitCandidate: boolean;    // Human skin tones detected
  isLandscapeCandidate: boolean;   // Nature / greenery / sky detected
  isGoldenHourCandidate: boolean;  // Warm golden highlights + contrast
  dominantHueFamily: 'warm' | 'cool' | 'greenery' | 'monochrome' | 'neutral';
}

export interface PresetRecommendation {
  preset: Preset;
  matchScore: number;              // 0 to 100 (%)
  category: string;
  reason: string;
  suggestedIntensity: number;      // Recommended initial strength (typically 80-100)
  provider: 'deterministic-analysis' | 'cloud-ai';
}

export interface SmartPresetOptions {
  provider?: 'auto' | 'deterministic' | 'cloud';
  userConsent?: boolean;
  signal?: AbortSignal;
  onProgress?: (percent: number, status: string) => void;
}

export interface SmartPresetResult {
  recommendations: PresetRecommendation[];
  metrics: ImageAnalysisMetrics;
  provider: 'deterministic-analysis' | 'cloud-ai';
  durationMs: number;
  explanation: string;
}

export interface SmartPresetEngine {
  recommendPresets(
    source: ImageData | HTMLImageElement | HTMLCanvasElement | { data: Uint8ClampedArray; width: number; height: number },
    options?: SmartPresetOptions
  ): Promise<SmartPresetResult>;
}
