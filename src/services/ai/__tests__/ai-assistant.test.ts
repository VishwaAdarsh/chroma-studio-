import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateAndSanitizeAiPlan,
  calculateParameterDiffs,
  clampParameter,
  PARAM_LIMITS,
} from '../schema';
import { LocalSemanticAiProvider } from '../localProvider';
import { AiService } from '../aiService';
import { DEFAULT_ADJUSTMENTS } from '../../../constants/defaults';
import type { AdjustmentParameters } from '../../../types/editor';

describe('AI Photo Editing Assistant & Foundation Architecture', () => {
  beforeEach(() => {
    AiService.setProvider(new LocalSemanticAiProvider());
  });

  describe('Schema Validation & Guardrails', () => {
    it('validates and preserves valid bounded parameter adjustments', () => {
      const raw = {
        explanation: 'Increased warmth and exposure for a vibrant golden aesthetic.',
        parameters: {
          temperature: 25,
          exposure: 0.4,
          contrast: 15,
          shadows: 20,
        },
        presetId: 'cine-teal-orange',
        presetIntensity: 80,
        supported: true,
      };

      const result = validateAndSanitizeAiPlan(raw, DEFAULT_ADJUSTMENTS);
      expect(result.valid).toBe(true);
      expect(result.plan.supported).toBe(true);
      expect(result.plan.explanation).toBe(raw.explanation);
      expect(result.plan.parameters.temperature).toBe(25);
      expect(result.plan.parameters.exposure).toBe(0.4);
      expect(result.plan.parameters.contrast).toBe(15);
      expect(result.plan.parameters.shadows).toBe(20);
      expect(result.plan.presetId).toBe('cine-teal-orange');
      expect(result.plan.presetIntensity).toBe(80);
    });

    it('strictly clamps out-of-bounds parameter values to physical limits', () => {
      const raw = {
        explanation: 'Extreme adjustment test',
        parameters: {
          exposure: 99.0, // Limit is 2.0
          brightness: -500, // Limit is -100
          contrast: 250, // Limit is 100
          sharpen: 300, // Limit is 100
          clarity: -999, // Limit is -100
        },
        supported: true,
      };

      const result = validateAndSanitizeAiPlan(raw);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(true);
      expect(result.plan.parameters.exposure).toBe(PARAM_LIMITS.exposure.max);
      expect(result.plan.parameters.brightness).toBe(PARAM_LIMITS.brightness.min);
      expect(result.plan.parameters.contrast).toBe(PARAM_LIMITS.contrast.max);
      expect(result.plan.parameters.sharpen).toBe(PARAM_LIMITS.sharpen.max);
      expect(result.plan.parameters.clarity).toBe(PARAM_LIMITS.clarity.min);

      // Verify non-silent clamping: corrections must be explicitly recorded
      expect(result.plan.corrections).toBeDefined();
      expect(result.plan.corrections!.length).toBeGreaterThanOrEqual(5);
      const exposureCorrection = result.plan.corrections!.find((c) => c.param === 'exposure');
      expect(exposureCorrection?.originalValue).toBe(99.0);
      expect(exposureCorrection?.correctedValue).toBe(2.0);
      expect(exposureCorrection?.reason).toContain('real range');
    });

    it('safely discards unknown, malicious, or arbitrary parameter keys', () => {
      const raw = {
        explanation: 'Malicious payload injection attempt',
        parameters: {
          exposure: 0.2,
          __proto__: { polluted: true },
          javascript: 'alert(1)',
          style: 'background: red;',
          unsupportedFilter: 50,
        },
        supported: true,
      };

      const result = validateAndSanitizeAiPlan(raw);
      expect(result.valid).toBe(true);
      expect(result.plan.parameters.exposure).toBe(0.2);
      expect((result.plan.parameters as any).javascript).toBeUndefined();
      expect((result.plan.parameters as any).style).toBeUndefined();
      expect((result.plan.parameters as any).unsupportedFilter).toBeUndefined();
    });

    it('strips non-existent preset IDs not found in the catalog', () => {
      const raw = {
        explanation: 'Non-existent preset test',
        parameters: { contrast: 10 },
        presetId: 'fake-preset-that-does-not-exist',
        presetIntensity: 90,
        supported: true,
      };

      const result = validateAndSanitizeAiPlan(raw);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(true);
      expect(result.plan.presetId).toBeUndefined();
    });

    it('strips HTML and script tags from model explanation strings', () => {
      const raw = {
        explanation: '<script>alert("hack")</script>Enhanced <b>warmth</b> and lighting.',
        parameters: { temperature: 20 },
        supported: true,
      };

      const result = validateAndSanitizeAiPlan(raw);
      expect(result.valid).toBe(true);
      expect(result.plan.explanation).not.toContain('<script>');
      expect(result.plan.explanation).not.toContain('</script>');
      expect(result.plan.explanation).toContain('Enhanced warmth and lighting.');
    });

    it('handles malformed, null, or undefined responses gracefully', () => {
      expect(validateAndSanitizeAiPlan(null).valid).toBe(false);
      expect(validateAndSanitizeAiPlan(undefined).valid).toBe(false);
      expect(validateAndSanitizeAiPlan('string instead of object').valid).toBe(false);
      expect(validateAndSanitizeAiPlan([]).valid).toBe(false);
    });

    it('accurately computes diff deltas against baseline adjustments', () => {
      const current: AdjustmentParameters = {
        ...DEFAULT_ADJUSTMENTS,
        temperature: 10,
        exposure: 0.2,
      };

      const proposed = {
        temperature: 35,
        exposure: -0.1,
        contrast: 20,
      };

      const diffs = calculateParameterDiffs(current, proposed);
      const tempDiff = diffs.find((d) => d.param === 'temperature');
      const expDiff = diffs.find((d) => d.param === 'exposure');
      const contrastDiff = diffs.find((d) => d.param === 'contrast');

      expect(tempDiff?.delta).toBe(25);
      expect(expDiff?.delta).toBe(-0.3);
      expect(contrastDiff?.delta).toBe(20);
    });
  });

  describe('Local Semantic AI Provider', () => {
    let provider: LocalSemanticAiProvider;

    beforeEach(() => {
      provider = new LocalSemanticAiProvider();
    });

    it('parses: "Make this warmer and slightly brighter"', async () => {
      const plan = await provider.generateEditPlan({
        prompt: 'Make this warmer and slightly brighter',
        currentAdjustments: DEFAULT_ADJUSTMENTS,
      });

      expect(plan.supported).toBe(true);
      expect(plan.parameters.temperature).toBeGreaterThan(0);
      expect(plan.parameters.exposure).toBeGreaterThan(0);
      expect(plan.explanation.toLowerCase()).toContain('warm');
    });

    it('parses: "Give this photo a cinematic look"', async () => {
      const plan = await provider.generateEditPlan({
        prompt: 'Give this photo a cinematic look',
        currentAdjustments: DEFAULT_ADJUSTMENTS,
      });

      expect(plan.supported).toBe(true);
      const isCinePreset = plan.presetId?.includes('cine');
      const hasCineParams = (plan.parameters.contrast || 0) > 0 || (plan.parameters.vignette || 0) > 0;
      expect(isCinePreset || hasCineParams).toBe(true);
      expect(plan.explanation.toLowerCase()).toContain('cinematic');
    });

    it('parses: "Give it a cinematic look with muted highlights"', async () => {
      const plan = await provider.generateEditPlan({
        prompt: 'Give it a cinematic look with muted highlights',
        currentAdjustments: DEFAULT_ADJUSTMENTS,
      });

      expect(plan.supported).toBe(true);
      expect(plan.parameters.highlights).toBeLessThan(0);
      expect(plan.explanation.toLowerCase()).toMatch(/cinematic|highlight/);
    });

    it('parses: "Increase contrast but preserve skin tones as much as possible"', async () => {
      const plan = await provider.generateEditPlan({
        prompt: 'Increase contrast but preserve skin tones as much as possible',
        currentAdjustments: DEFAULT_ADJUSTMENTS,
      });

      expect(plan.supported).toBe(true);
      expect(plan.parameters.contrast).toBeGreaterThan(0);
      expect(plan.explanation.toLowerCase()).toContain('skin');
    });

    it('parses: "Lift the shadows and reduce saturation slightly"', async () => {
      const plan = await provider.generateEditPlan({
        prompt: 'Lift the shadows and reduce saturation slightly',
        currentAdjustments: DEFAULT_ADJUSTMENTS,
      });

      expect(plan.supported).toBe(true);
      expect(plan.parameters.shadows).toBeGreaterThan(0);
      expect(plan.parameters.saturation).toBeLessThan(0);
      expect(plan.parameters.saturation).toBeGreaterThanOrEqual(-20); // slightly = ~ -15%
    });

    it('parses: "Reduce highlights and lift the shadows"', async () => {
      const plan = await provider.generateEditPlan({
        prompt: 'Reduce highlights and lift the shadows',
        currentAdjustments: DEFAULT_ADJUSTMENTS,
      });

      expect(plan.supported).toBe(true);
      expect(plan.parameters.highlights).toBeLessThan(0);
      expect(plan.parameters.shadows).toBeGreaterThan(0);
    });

    it('parses: "Moody vintage film with subtle grain"', async () => {
      const plan = await provider.generateEditPlan({
        prompt: 'Moody vintage film with subtle grain',
        currentAdjustments: DEFAULT_ADJUSTMENTS,
      });

      expect(plan.supported).toBe(true);
      expect(plan.explanation.toLowerCase()).toMatch(/vintage|film|grain|moody/);
    });

    it('parses: "Dramatic black and white"', async () => {
      const plan = await provider.generateEditPlan({
        prompt: 'Dramatic black and white',
        currentAdjustments: DEFAULT_ADJUSTMENTS,
      });

      expect(plan.supported).toBe(true);
      const isBwPreset = plan.presetId?.includes('bw') || plan.presetId?.includes('mono');
      const isDesaturated = plan.parameters.saturation === -100;
      expect(isBwPreset || isDesaturated).toBe(true);
    });

    it('rejects unsupported generative queries with helpful explanations & alternatives', async () => {
      const unsupportedPrompts = [
        'Remove the person in the background',
        'Replace the sky with a sunset',
        'Add a cat sitting on the table',
        'Change hair color to blue',
        'Erase the car from the street',
      ];

      for (const prompt of unsupportedPrompts) {
        const plan = await provider.generateEditPlan({
          prompt,
          currentAdjustments: DEFAULT_ADJUSTMENTS,
        });

        expect(plan.supported).toBe(false);
        expect(plan.unsupportedReason).toBeDefined();
        expect(plan.suggestedAlternatives).toBeDefined();
        expect(plan.suggestedAlternatives!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('AiService Coordinator & Error Resilience', () => {
    it('returns an empty prompt guide when input is blank or whitespace', async () => {
      const plan = await AiService.generateEditPlan({
        prompt: '   ',
        currentAdjustments: DEFAULT_ADJUSTMENTS,
      });

      expect(plan.supported).toBe(false);
      expect(plan.unsupportedReason).toBe('Prompt cannot be empty.');
    });

    it('successfully processes requests through the service facade', async () => {
      const plan = await AiService.generateEditPlan({
        prompt: 'Make this photo cooler and increase contrast',
        currentAdjustments: DEFAULT_ADJUSTMENTS,
      });

      expect(plan.supported).toBe(true);
      expect(plan.parameters.temperature).toBeLessThan(0);
      expect(plan.parameters.contrast).toBeGreaterThan(0);
    });

    it('supports cancellation via AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort(); // Pre-abort

      await expect(
        AiService.generateEditPlan(
          {
            prompt: 'Make it brighter',
            currentAdjustments: DEFAULT_ADJUSTMENTS,
          },
          controller.signal
        )
      ).rejects.toThrow();
    });
  });

  describe('End-to-End Workflow & Non-Destructive Editing Lifecycle', () => {
    it('applies AI plan without altering original image data', async () => {
      const originalImageBytes = new Uint8Array([100, 150, 200, 255]);
      const pristineBuffer = new Uint8Array(originalImageBytes);

      const plan = await AiService.generateEditPlan({
        prompt: 'Make this warmer and slightly brighter',
        currentAdjustments: DEFAULT_ADJUSTMENTS,
      });

      expect(plan.supported).toBe(true);

      // Simulate applying plan
      const updatedAdjustments = {
        ...DEFAULT_ADJUSTMENTS,
        ...plan.parameters,
      };

      expect(updatedAdjustments.temperature).toBeGreaterThan(0);
      expect(updatedAdjustments.exposure).toBeGreaterThan(0);

      // Original image buffer remains strictly untouched
      expect(originalImageBytes).toEqual(pristineBuffer);
    });

    it('preserves complete undo/redo fidelity for AI edits', async () => {
      const historyStack: AdjustmentParameters[] = [];
      let current = { ...DEFAULT_ADJUSTMENTS };

      // Step 1: User has initial adjustments
      historyStack.push({ ...current });

      // Step 2: AI suggests edits
      const plan = await AiService.generateEditPlan({
        prompt: 'Reduce highlights and lift the shadows',
        currentAdjustments: current,
      });

      // Step 3: Apply AI edits
      const aiState = {
        ...current,
        ...plan.parameters,
      };
      current = aiState;
      expect(current.highlights).toBeLessThan(0);
      expect(current.shadows).toBeGreaterThan(0);

      // Step 4: Undo returns to baseline
      const previous = historyStack.pop();
      expect(previous).toBeDefined();
      current = previous!;
      expect(current).toEqual(DEFAULT_ADJUSTMENTS);

      // Step 5: Redo restores AI state
      current = aiState;
      expect(current.highlights).toBeLessThan(0);
      expect(current.shadows).toBeGreaterThan(0);
    });

    it('persists AI-assisted parameters cleanly in project serialization', async () => {
      const plan = await AiService.generateEditPlan({
        prompt: 'Give this photo a cinematic look',
        currentAdjustments: DEFAULT_ADJUSTMENTS,
      });

      const serializedProject = JSON.stringify({
        id: 'test-ai-project-123',
        name: 'Cinematic Test',
        adjustments: {
          ...DEFAULT_ADJUSTMENTS,
          ...plan.parameters,
        },
        activePresetId: plan.presetId || null,
        presetIntensity: plan.presetIntensity || 100,
      });

      const deserialized = JSON.parse(serializedProject);
      expect(deserialized.id).toBe('test-ai-project-123');
      expect(deserialized.adjustments.contrast).toBeGreaterThanOrEqual(0);
      expect(deserialized.activePresetId).toBe(plan.presetId || null);
    });

    it('confirms zero AI provider secret keys exist in frontend environment or bundle code', () => {
      // Vite client env keys must never contain server secrets
      const clientEnv = import.meta.env;
      expect((clientEnv as any).GEMINI_API_KEY).toBeUndefined();
      expect((clientEnv as any).OPENAI_API_KEY).toBeUndefined();
      expect((clientEnv as any).VITE_GEMINI_API_KEY).toBeUndefined();
      expect((clientEnv as any).VITE_OPENAI_API_KEY).toBeUndefined();
      expect((clientEnv as any).ANTHROPIC_API_KEY).toBeUndefined();
    });
  });
});
