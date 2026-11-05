// Chroma Studio — AI Inpainting & Object Removal Types

import type { InpaintBoundingBox } from '../../types/editor';

export type InpaintProvider = 'on-device' | 'cloud-ai' | 'texture-patch';

export interface InpaintOptions {
  provider?: InpaintProvider;
  feather?: number;       // Edge feathering in px (0 to 12)
  expansion?: number;     // Mask boundary dilation in px (0 to 10)
  userConsent?: boolean;  // Explicit consent for cloud transmission
  signal?: AbortSignal;   // Cancellation controller signal
  onProgress?: (percent: number, status: string) => void;
}

export interface InpaintResult {
  inpaintedDataUrl: string;
  outputBuffer: Uint8ClampedArray;
  width: number;
  height: number;
  provider: InpaintProvider;
  durationMs: number;
  confidence: number;
  bounds: InpaintBoundingBox;
  explanation?: string;
}

export interface InpaintEngine {
  inpaint(
    sourceImage:
      | ImageData
      | HTMLImageElement
      | HTMLCanvasElement
      | { data: Uint8ClampedArray; width: number; height: number },
    mask:
      | ImageData
      | HTMLCanvasElement
      | { data: Uint8ClampedArray; width: number; height: number },
    options?: InpaintOptions
  ): Promise<InpaintResult>;
}
