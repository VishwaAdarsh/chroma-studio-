import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { AiEditPlan, AiEditRequest, AiProvider } from './types';
import { validateAndSanitizeAiPlan } from './schema';
import { LocalSemanticAiProvider } from './localProvider';

export class SupabaseEdgeAiProvider implements AiProvider {
  name = 'Supabase Edge AI Assistant';
  private localFallback = new LocalSemanticAiProvider();

  async isAvailable(): Promise<boolean> {
    return isSupabaseConfigured && Boolean(supabase);
  }

  async generateEditPlan(request: AiEditRequest, signal?: AbortSignal): Promise<AiEditPlan> {
    if (!isSupabaseConfigured || !supabase) {
      // Offline / guest mode -> seamless local semantic fallback
      return this.localFallback.generateEditPlan(request);
    }

    // Set up a 15-second timeout controller linked to optional caller signal
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), 15000);

    const onCallerAbort = () => {
      timeoutController.abort();
    };

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        throw new DOMException('Operation aborted by user', 'AbortError');
      }
      signal.addEventListener('abort', onCallerAbort);
    }

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          prompt: request.prompt,
          currentAdjustments: request.currentAdjustments,
          currentPresetId: request.currentPresetId,
          currentPresetIntensity: request.currentPresetIntensity,
        },
      });

      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onCallerAbort);

      if (error || !data) {
        console.warn(
          '[Chroma Studio AI] Supabase Edge Function error or not yet deployed. Seamlessly falling back to on-device semantic engine:',
          error
        );
        return this.localFallback.generateEditPlan(request);
      }

      // Validate and sanitize raw response with strict schema
      const validation = validateAndSanitizeAiPlan(data.plan || data, request.currentAdjustments);
      return validation.plan;
    } catch (err: unknown) {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onCallerAbort);

      const isAbort = (err as Error)?.name === 'AbortError' || timeoutController.signal.aborted;
      if (isAbort && signal?.aborted) {
        throw new DOMException('AI request cancelled by user', 'AbortError');
      }

      console.warn(
        '[Chroma Studio AI] Network or execution issue calling Edge Function. Falling back to on-device assistant:',
        err
      );
      return this.localFallback.generateEditPlan(request);
    }
  }
}
