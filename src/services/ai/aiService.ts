import type { AiEditPlan, AiEditRequest, AiProvider } from './types';
import { SupabaseEdgeAiProvider } from './supabaseProvider';
import { LocalSemanticAiProvider } from './localProvider';
import { validateAndSanitizeAiPlan } from './schema';

export class AiService {
  private static provider: AiProvider = new SupabaseEdgeAiProvider();
  private static localProvider: AiProvider = new LocalSemanticAiProvider();
  private static activeController: AbortController | null = null;
  private static lastRequestTime = 0;
  private static readonly RATE_LIMIT_MS = 400; // Minimum interval between requests

  /**
   * Set custom provider (useful for testing or switching models)
   */
  static setProvider(newProvider: AiProvider): void {
    this.provider = newProvider;
  }

  /**
   * Reset provider back to default Supabase Edge Provider with local fallback
   */
  static resetProvider(): void {
    this.provider = new SupabaseEdgeAiProvider();
  }

  /**
   * Cancel any in-flight AI generation request
   */
  static cancelActiveRequest(): void {
    if (this.activeController) {
      this.activeController.abort();
      this.activeController = null;
    }
  }

  /**
   * Generates a structured photo editing plan from user prompt
   */
  static async generateEditPlan(
    request: AiEditRequest,
    externalSignal?: AbortSignal
  ): Promise<AiEditPlan> {
    const trimmedPrompt = request.prompt.trim();
    if (!trimmedPrompt) {
      return {
        explanation: 'Please enter a description of how you would like to edit the photo.',
        parameters: {},
        supported: false,
        unsupportedReason: 'Prompt cannot be empty.',
        suggestedAlternatives: [
          '“Make this warmer and slightly brighter”',
          '“Give this photo a cinematic look”',
          '“Reduce highlights and lift the shadows”',
        ],
      };
    }

    // Rate-limiting check
    const now = Date.now();
    if (now - this.lastRequestTime < this.RATE_LIMIT_MS) {
      await new Promise((res) => setTimeout(res, this.RATE_LIMIT_MS - (now - this.lastRequestTime)));
    }
    this.lastRequestTime = Date.now();

    // Abort previous in-flight request if any
    this.cancelActiveRequest();
    this.activeController = new AbortController();

    const internalSignal = this.activeController.signal;

    // Merge external signal with internal signal
    const combinedSignalHandler = () => {
      this.cancelActiveRequest();
    };

    const effectiveSignal = externalSignal || (request as any).signal;
    if (effectiveSignal) {
      if (effectiveSignal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }
      effectiveSignal.addEventListener('abort', combinedSignalHandler);
    }

    try {
      let rawPlan: AiEditPlan;
      try {
        rawPlan = await this.provider.generateEditPlan(request, internalSignal);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          throw err;
        }
        // Fall back to local provider
        console.warn('[AiService] Primary provider failed, invoking local fallback:', err);
        rawPlan = await this.localProvider.generateEditPlan(request, internalSignal);
      }

      // Final schema validation & clamping guarantee
      const validation = validateAndSanitizeAiPlan(rawPlan, request.currentAdjustments);
      return validation.plan;
    } finally {
      if (externalSignal) {
        externalSignal.removeEventListener('abort', combinedSignalHandler);
      }
      this.activeController = null;
    }
  }
}
