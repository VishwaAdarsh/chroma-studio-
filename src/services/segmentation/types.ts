// Chroma Studio — AI Background Removal & Segmentation Types

export type SegmentationProvider = 'on-device' | 'cloud';

export interface SegmentationOptions {
  provider?: SegmentationProvider;
  tolerance?: number;      // 0 to 100 (sensitivity threshold)
  feather?: number;        // 0 to 20 px (edge softness)
  invert?: boolean;        // Invert mask (keep background vs keep subject)
  userConsent?: boolean;   // Explicit consent for remote processing (required for cloud)
  signal?: AbortSignal;    // Cancellation controller signal
  onProgress?: (percent: number, status: string) => void;
}

export interface SegmentationResult {
  maskData: string;               // Base64 PNG data URL of the alpha mask
  alphaArray: Uint8ClampedArray;  // Continuous 8-bit alpha values (0-255)
  width: number;
  height: number;
  provider: SegmentationProvider;
  durationMs: number;
  confidence: number;             // Quality/confidence score 0.0 - 1.0
}

export interface SegmentationEngine {
  segment(
    source: ImageData | HTMLImageElement | HTMLCanvasElement | { data: Uint8ClampedArray; width: number; height: number },
    options?: SegmentationOptions
  ): Promise<SegmentationResult>;
}
