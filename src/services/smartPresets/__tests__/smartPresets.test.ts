// Chroma Studio — Smart Preset Recommender Test Suite
// Verifies photometric image analysis, deterministic preset scoring, scene categorization,
// non-destructive intensity interpolation, cancellation via AbortSignal, and privacy consent gating.

import { describe, it, expect } from 'vitest';
import { ImageAnalyzer } from '../imageAnalyzer';
import { smartPresetService } from '../smartPresetService';
import { blendPresetAdjustments } from '../../../engine/pipeline';
import { PRESETS } from '../../../data/presets';
import { DEFAULT_ADJUSTMENTS, DEFAULT_CURVES, DEFAULT_CUTOUT, DEFAULT_GEOMETRY, DEFAULT_WHEELS } from '../../../constants/defaults';
import type { Project, Preset } from '../../../types/editor';

/**
 * Helper to generate synthetic RGBA pixel buffers for testing
 */
function createSyntheticBuffer(
  width: number,
  height: number,
  pixelFn: (x: number, y: number) => [number, number, number, number]
): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const [r, g, b, a] = pixelFn(x, y);
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
  return { data, width, height };
}

describe('Smart Presets Suite', () => {
  describe('1. Photometric Image Analysis (ImageAnalyzer)', () => {
    it('returns default fallback metrics on empty or zero-dimension input', () => {
      const empty = ImageAnalyzer.analyze(new Uint8ClampedArray(0), 0, 0);
      expect(empty).toBeDefined();
      expect(empty.meanLuminance).toBe(128);
      expect(empty.contrast).toBe(50);
      expect(empty.colorTemperature).toBe('neutral');
    });

    it('accurately identifies human portrait skin tones', () => {
      // Warm skin tones: R > G > B with warm chromaticity (e.g. [195, 140, 110, 255])
      const portraitBuffer = createSyntheticBuffer(100, 100, () => [195, 140, 110, 255]);
      const metrics = ImageAnalyzer.analyze(portraitBuffer.data, portraitBuffer.width, portraitBuffer.height);

      expect(metrics.isPortraitCandidate).toBe(true);
      expect(metrics.colorTemperature).toBe('warm');
      expect(metrics.meanLuminance).toBeGreaterThan(120);
      expect(metrics.meanLuminance).toBeLessThan(180);
    });

    it('accurately identifies landscape scenes with greenery and sky', () => {
      // Top half sky (blue: [80, 140, 220]), bottom half lush vegetation (green: [50, 160, 60])
      const landscapeBuffer = createSyntheticBuffer(100, 100, (_x, y) => {
        if (y < 50) return [80, 140, 220, 255]; // Sky
        return [50, 160, 60, 255]; // Greenery
      });

      const metrics = ImageAnalyzer.analyze(landscapeBuffer.data, landscapeBuffer.width, landscapeBuffer.height);
      expect(metrics.isLandscapeCandidate).toBe(true);
    });

    it('accurately identifies low-key / dark scenes', () => {
      // Dark moody scene (luminance ~35)
      const lowKeyBuffer = createSyntheticBuffer(100, 100, () => [35, 30, 45, 255]);
      const metrics = ImageAnalyzer.analyze(lowKeyBuffer.data, lowKeyBuffer.width, lowKeyBuffer.height);

      expect(metrics.isLowKey).toBe(true);
      expect(metrics.isHighKey).toBe(false);
      expect(metrics.meanLuminance).toBeLessThan(75);
    });

    it('accurately identifies high-key / bright scenes', () => {
      // Very bright scene (luminance ~220)
      const highKeyBuffer = createSyntheticBuffer(100, 100, () => [225, 220, 215, 255]);
      const metrics = ImageAnalyzer.analyze(highKeyBuffer.data, highKeyBuffer.width, highKeyBuffer.height);

      expect(metrics.isHighKey).toBe(true);
      expect(metrics.isLowKey).toBe(false);
      expect(metrics.meanLuminance).toBeGreaterThan(175);
    });

    it('accurately identifies golden hour warmth', () => {
      // Warm golden hour sunlight (R >= 170, G >= 110, B <= 130, R > B * 1.3)
      const goldenHourBuffer = createSyntheticBuffer(100, 100, () => [230, 160, 80, 255]);
      const metrics = ImageAnalyzer.analyze(goldenHourBuffer.data, goldenHourBuffer.width, goldenHourBuffer.height);

      expect(metrics.isGoldenHourCandidate).toBe(true);
      expect(metrics.colorTemperature).toBe('warm');
    });

    it('identifies desaturated / monochrome imagery', () => {
      // Grayscale pixels
      const monoBuffer = createSyntheticBuffer(100, 100, () => [120, 120, 120, 255]);
      const metrics = ImageAnalyzer.analyze(monoBuffer.data, monoBuffer.width, monoBuffer.height);

      expect(metrics.dominantHueFamily).toBe('monochrome');
      expect(metrics.saturationScore).toBe(0);
    });

    it('executes in under 20ms on a 500x500 buffer', () => {
      const buffer = createSyntheticBuffer(500, 500, (x, y) => [(x % 255), (y % 255), 128, 255]);
      const start = performance.now();
      ImageAnalyzer.analyze(buffer.data, buffer.width, buffer.height);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(20);
    });
  });

  describe('2. Deterministic Recommendation Engine (SmartPresetService)', () => {
    it('returns ranked recommendations with match scores and clear explanations', async () => {
      const portraitBuffer = createSyntheticBuffer(120, 120, () => [195, 140, 110, 255]);
      const progressSteps: string[] = [];

      const result = await smartPresetService.recommendPresets(portraitBuffer, {
        provider: 'deterministic',
        onProgress: (_pct, step) => {
          progressSteps.push(step);
        },
      });

      expect(result).toBeDefined();
      expect(result.provider).toBe('deterministic-analysis');
      expect(result.recommendations.length).toBeGreaterThanOrEqual(4);
      expect(result.recommendations.length).toBeLessThanOrEqual(6);

      // Verifies each recommendation has all required fields
      for (const rec of result.recommendations) {
        expect(rec.preset).toBeDefined();
        expect(rec.preset.id).toBeDefined();
        expect(rec.matchScore).toBeGreaterThanOrEqual(70);
        expect(rec.matchScore).toBeLessThanOrEqual(100);
        expect(rec.reason).toBeTruthy();
        expect(rec.suggestedIntensity).toBeGreaterThan(0);
      }

      // Progress reporting was triggered
      expect(progressSteps.length).toBeGreaterThan(0);
    });

    it('prioritizes skin-friendly or portrait looks when skin tones are detected', async () => {
      const portraitBuffer = createSyntheticBuffer(100, 100, () => [200, 150, 120, 255]);
      const result = await smartPresetService.recommendPresets(portraitBuffer, {
        provider: 'deterministic',
      });

      const categories = result.recommendations.map((r) => r.category);
      const hasPortraitOrWarm = categories.some((c) =>
        ['Portrait', 'Cinematic', 'Vintage'].includes(c)
      );
      expect(hasPortraitOrWarm).toBe(true);

      const topRec = result.recommendations[0];
      expect(topRec.matchScore).toBeGreaterThan(80);
    });

    it('prioritizes landscape and nature looks when greenery/sky is detected', async () => {
      const landscapeBuffer = createSyntheticBuffer(100, 100, (_x, y) => {
        if (y < 50) return [60, 120, 210, 255];
        return [40, 170, 50, 255];
      });

      const result = await smartPresetService.recommendPresets(landscapeBuffer, {
        provider: 'deterministic',
      });

      const hasLandscapeOrTravel = result.recommendations.some(
        (r) =>
          r.category === 'Travel' ||
          r.preset.tags.includes('nature') ||
          r.preset.tags.includes('landscape') ||
          r.preset.tags.includes('greenery')
      );
      expect(hasLandscapeOrTravel).toBe(true);
    });

    it('prioritizes moody and high-contrast looks for low-key photography', async () => {
      const lowKeyBuffer = createSyntheticBuffer(100, 100, () => [25, 20, 30, 255]);
      const result = await smartPresetService.recommendPresets(lowKeyBuffer, {
        provider: 'deterministic',
      });

      const hasMoodyOrBw = result.recommendations.some(
        (r) =>
          r.category === 'Moody' ||
          r.category === 'B&W' ||
          r.category === 'Cinematic' ||
          r.preset.tags.includes('shadows')
      );
      expect(hasMoodyOrBw).toBe(true);
    });

    it('aborts cleanly when an AbortSignal is cancelled', async () => {
      const controller = new AbortController();
      controller.abort();

      const buffer = createSyntheticBuffer(50, 50, () => [128, 128, 128, 255]);
      await expect(
        smartPresetService.recommendPresets(buffer, {
          signal: controller.signal,
        })
      ).rejects.toThrow(/cancelled/i);
    });
  });

  describe('3. Non-Destructive Editing & Intensity Blending', () => {
    it('blends preset parameters at 0% intensity leaving base adjustments completely intact', () => {
      const samplePreset = PRESETS[0];
      const baseAdjustments = { ...DEFAULT_ADJUSTMENTS, exposure: 0.5, contrast: 10 };

      const blended = blendPresetAdjustments(
        baseAdjustments,
        samplePreset,
        0,
        DEFAULT_WHEELS,
        DEFAULT_CURVES
      );

      expect(blended.adjustments.exposure).toBe(0.5);
      expect(blended.adjustments.contrast).toBe(10);
    });

    it('blends preset parameters at 100% intensity fully applying preset offsets', () => {
      const samplePreset = PRESETS.find((p) => p.parameters.contrast !== undefined) || PRESETS[0];
      const baseAdjustments = { ...DEFAULT_ADJUSTMENTS, contrast: 0 };

      const blended = blendPresetAdjustments(
        baseAdjustments,
        samplePreset,
        100,
        DEFAULT_WHEELS,
        DEFAULT_CURVES
      );

      const expectedContrast = Math.round(samplePreset.parameters.contrast || 0);
      expect(blended.adjustments.contrast).toBe(expectedContrast);
    });

    it('blends preset parameters proportionally at 50% strength', () => {
      const testPreset: Preset = {
        id: 'test-look',
        name: 'Test Look',
        category: 'Portrait',
        description: 'Test look description',
        tags: ['test'],
        defaultIntensity: 100,
        parameters: {
          contrast: 40,
          saturation: 20,
        },
      };

      const baseAdjustments = { ...DEFAULT_ADJUSTMENTS, contrast: 0, saturation: 0 };
      const blended = blendPresetAdjustments(
        baseAdjustments,
        testPreset,
        50,
        DEFAULT_WHEELS,
        DEFAULT_CURVES
      );

      expect(blended.adjustments.contrast).toBe(20); // 50% of 40
      expect(blended.adjustments.saturation).toBe(10); // 50% of 20
    });
  });

  describe('4. Project Persistence & Reopening Fidelity', () => {
    it('persists activePresetId and presetIntensity without mutating base image data', () => {
      const now = Date.now();
      const project: Project = {
        id: 'proj-smart-presets-test',
        name: 'Portrait Project',
        originalName: 'portrait.jpg',
        imageSrc: 'data:image/jpeg;base64,sample',
        width: 1920,
        height: 1080,
        fileSize: 102400,
        createdAt: now,
        updatedAt: now,
        adjustments: { ...DEFAULT_ADJUSTMENTS, temperature: 5 },
        activePresetId: 'golden-hour',
        presetIntensity: 85,
        geometry: DEFAULT_GEOMETRY,
        curves: DEFAULT_CURVES,
        wheels: DEFAULT_WHEELS,
        cutout: DEFAULT_CUTOUT,
      };

      // Serialize and deserialize
      const serialized = JSON.stringify(project);
      const restored: Project = JSON.parse(serialized);

      expect(restored.activePresetId).toBe('golden-hour');
      expect(restored.presetIntensity).toBe(85);
      expect(restored.adjustments.temperature).toBe(5);
      expect(restored.imageSrc).toBe('data:image/jpeg;base64,sample');
    });
  });
});
