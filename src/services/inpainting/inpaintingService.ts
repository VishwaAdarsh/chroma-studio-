// Chroma Studio — AI Inpainting Service Facade
// Coordinates on-device and cloud inpainting engines, cancellation signals, and progress reporting.

import type {
  InpaintEngine,
  InpaintOptions,
  InpaintResult,
  InpaintProvider,
} from './types';
import { OnDeviceInpainter } from './onDeviceInpainter';
import { SupabaseInpainter } from './supabaseInpainter';

class InpaintingService {
  private onDeviceEngine: InpaintEngine = new OnDeviceInpainter();
  private cloudEngine: InpaintEngine = new SupabaseInpainter();
  private activeAbortController: AbortController | null = null;

  async inpaintObject(
    sourceImage:
      | ImageData
      | HTMLImageElement
      | HTMLCanvasElement
      | { data: Uint8ClampedArray; width: number; height: number },
    mask:
      | ImageData
      | HTMLCanvasElement
      | { data: Uint8ClampedArray; width: number; height: number },
    options: InpaintOptions = {}
  ): Promise<InpaintResult> {
    this.cancelCurrentOperation();

    const controller = new AbortController();
    this.activeAbortController = controller;

    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        options.signal.addEventListener('abort', () => controller.abort());
      }
    }

    const effectiveOptions: InpaintOptions = {
      ...options,
      signal: controller.signal,
    };

    const provider: InpaintProvider = options.provider || 'on-device';
    const engine = provider === 'cloud-ai' ? this.cloudEngine : this.onDeviceEngine;

    try {
      const result = await engine.inpaint(sourceImage, mask, effectiveOptions);
      return result;
    } finally {
      if (this.activeAbortController === controller) {
        this.activeAbortController = null;
      }
    }
  }

  cancelCurrentOperation(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  isProcessing(): boolean {
    return this.activeAbortController !== null;
  }
}

export const inpaintingService = new InpaintingService();
