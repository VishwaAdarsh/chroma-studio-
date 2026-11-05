// Chroma Studio — Segmentation Service Facade
// Coordinates on-device and cloud providers, cancellation signals, progress updates, and mask caching.

import type {
  SegmentationEngine,
  SegmentationOptions,
  SegmentationResult,
  SegmentationProvider,
} from './types';
import { OnDeviceSegmenter } from './onDeviceSegmenter';
import { SupabaseSegmenter } from './supabaseSegmenter';

class SegmentationService {
  private onDeviceEngine: SegmentationEngine = new OnDeviceSegmenter();
  private cloudEngine: SegmentationEngine = new SupabaseSegmenter();
  private activeAbortController: AbortController | null = null;

  /**
   * Main entrypoint to remove background and extract the foreground subject.
   */
  async removeBackground(
    source:
      | ImageData
      | HTMLImageElement
      | HTMLCanvasElement
      | { data: Uint8ClampedArray; width: number; height: number },
    options: SegmentationOptions = {}
  ): Promise<SegmentationResult> {
    // If a previous operation is ongoing with the internal controller, abort it
    this.cancelCurrentOperation();

    const controller = new AbortController();
    this.activeAbortController = controller;

    // Chain external signal if passed
    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort();
        throw new DOMException('Operation aborted by user', 'AbortError');
      }
      options.signal.addEventListener('abort', () => controller.abort());
    }

    const effectiveOptions: SegmentationOptions = {
      ...options,
      signal: controller.signal,
    };

    const provider: SegmentationProvider = options.provider || 'on-device';
    const engine = provider === 'cloud' ? this.cloudEngine : this.onDeviceEngine;

    try {
      const result = await engine.segment(source, effectiveOptions);
      return result;
    } finally {
      if (this.activeAbortController === controller) {
        this.activeAbortController = null;
      }
    }
  }

  /**
   * Cancels any in-flight background removal operation.
   */
  cancelCurrentOperation(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  /**
   * Checks if an operation is currently active.
   */
  isProcessing(): boolean {
    return this.activeAbortController !== null;
  }
}

export const segmentationService = new SegmentationService();
