// Chroma Studio — AI Image Enhancement Service Facade
// Coordinates local on-device perceptual AI, cloud AI with privacy consent, and analytical fallbacks.

import type {
  EnhancementEngine,
  EnhancementOptions,
  EnhancementResult,
  EnhancementMode,
} from './types';
import type { AdjustmentParameters } from '../../types/editor';
import { PerceptualEnhancer } from './perceptualEngine';
import { SupabaseEnhancer } from './supabaseEnhancer';

class EnhancementService {
  private localEngine: EnhancementEngine = new PerceptualEnhancer();
  private cloudEngine: EnhancementEngine = new SupabaseEnhancer();
  private activeAbortController: AbortController | null = null;

  async enhanceImage(
    source:
      | ImageData
      | HTMLImageElement
      | HTMLCanvasElement
      | { data: Uint8ClampedArray; width: number; height: number },
    currentAdjustments: AdjustmentParameters,
    options: EnhancementOptions = {}
  ): Promise<EnhancementResult> {
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

    const effectiveOptions: EnhancementOptions = {
      ...options,
      signal: controller.signal,
    };

    const mode: EnhancementMode = options.mode || 'ai-local';
    const engine = mode === 'ai-cloud' ? this.cloudEngine : this.localEngine;

    try {
      const result = await engine.enhance(source, currentAdjustments, effectiveOptions);
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

export const enhancementService = new EnhancementService();
