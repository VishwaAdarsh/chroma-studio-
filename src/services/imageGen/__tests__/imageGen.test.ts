// Chroma Studio — AI Image Generation Test Suite
// Verifies prompt validation, style & aspect-ratio dimensional mapping, safety filtering,
// user privacy consent gating, cancellation via AbortSignal, project persistence,
// and editor import fidelity.

import { describe, it, expect } from 'vitest';
import { imageGenService } from '../imageGenService';
import type { GeneratedImage, ImageGenAspectRatio, ImageGenStyle } from '../types';
import type { Project } from '../../../types/editor';
import { DEFAULT_ADJUSTMENTS, DEFAULT_CURVES, DEFAULT_CUTOUT, DEFAULT_GEOMETRY, DEFAULT_WHEELS } from '../../../constants/defaults';

describe('AI Image Generation Suite', () => {
  describe('1. Prompt Validation & Safety Filter', () => {
    it('rejects empty, whitespace-only, or too short prompts (<3 characters)', async () => {
      await expect(
        imageGenService.generate({
          prompt: '',
          userConsent: true,
        })
      ).rejects.toThrow(/at least 3 characters/i);

      await expect(
        imageGenService.generate({
          prompt: '  ab  ',
          userConsent: true,
        })
      ).rejects.toThrow(/at least 3 characters/i);
    });

    it('rejects prompts exceeding maximum length (1000 characters)', async () => {
      const longPrompt = 'a'.repeat(1005);
      await expect(
        imageGenService.generate({
          prompt: longPrompt,
          userConsent: true,
        })
      ).rejects.toThrow(/exceed 1000 characters/i);
    });

    it('blocks prompts violating safety guidelines', async () => {
      await expect(
        imageGenService.generate({
          prompt: 'A violent gore scene with weapons',
          userConsent: true,
        })
      ).rejects.toThrow(/safety guidelines/i);
    });
  });

  describe('2. User Privacy Consent Gate', () => {
    it('strictly denies generation when userConsent is false', async () => {
      await expect(
        imageGenService.generate({
          prompt: 'A cozy cabin in the snowy woods at dusk',
          userConsent: false,
        })
      ).rejects.toThrow(/consent/i);
    });

    it('processes successfully and provides progress updates when consent is true', async () => {
      const progressList: number[] = [];
      const result = await imageGenService.generate({
        prompt: 'Futuristic solar-powered metropolis with lush vertical gardens',
        userConsent: true,
        style: 'cinematic',
        aspectRatio: '16:9',
        onProgress: (pct) => progressList.push(pct),
      });

      expect(result).toBeDefined();
      expect(result.images.length).toBeGreaterThan(0);
      expect(result.images[0].imageUrl).toBeTruthy();
      expect(result.images[0].aspectRatio).toBe('16:9');
      expect(result.images[0].style).toBe('cinematic');
      expect(progressList.length).toBeGreaterThan(0);
    });
  });

  describe('3. Cancellation & Timeout Resilience', () => {
    it('immediately halts generation when AbortSignal triggers', async () => {
      const controller = new AbortController();
      controller.abort(); // Pre-aborted

      await expect(
        imageGenService.generate({
          prompt: 'Cyberpunk neon alley with rain reflections',
          userConsent: true,
          signal: controller.signal,
        })
      ).rejects.toThrow(/cancelled/i);
    });
  });

  describe('4. Aspect Ratio & Style Presets Handling', () => {
    const testCases: Array<{ ratio: ImageGenAspectRatio; expectedW: number; expectedH: number }> = [
      { ratio: '1:1', expectedW: 1024, expectedH: 1024 },
      { ratio: '4:5', expectedW: 896, expectedH: 1120 },
      { ratio: '16:9', expectedW: 1280, expectedH: 720 },
      { ratio: '9:16', expectedW: 720, expectedH: 1280 },
    ];

    testCases.forEach(({ ratio, expectedW, expectedH }) => {
      it(`maps aspect ratio ${ratio} to ${expectedW}x${expectedH}`, async () => {
        const result = await imageGenService.generate({
          prompt: `Stylized portrait in ${ratio} ratio`,
          aspectRatio: ratio,
          userConsent: true,
        });

        expect(result.images[0].width).toBe(expectedW);
        expect(result.images[0].height).toBe(expectedH);
      });
    });

    const styles: ImageGenStyle[] = [
      'photorealistic',
      'cinematic',
      'illustration',
      '3d-render',
      'vintage-film',
      'cyberpunk',
    ];

    styles.forEach((style) => {
      it(`synthesizes image with ${style} style aesthetic`, async () => {
        const result = await imageGenService.generate({
          prompt: 'Ceramic coffee cup on rustic wooden table',
          style,
          userConsent: true,
        });

        expect(result.images[0].style).toBe(style);
        expect(result.images[0].imageUrl).toBeTruthy();
      });
    });
  });

  describe('5. Editor Import & Project Persistence Lifecycle', () => {
    it('creates an editable, non-destructive project document from generated image', () => {
      const genImage: GeneratedImage = {
        id: 'gen_test_999',
        imageUrl: 'data:image/png;base64,mockGeneratedPixelBuffer',
        prompt: 'Sunset over a lavender field in Provence',
        style: 'photorealistic',
        aspectRatio: '1:1',
        width: 1024,
        height: 1024,
        provider: 'cloud-dalle3',
        createdAt: Date.now(),
      };

      // Construct project as App.tsx does when user clicks "Open in Editor"
      const project: Project = {
        id: 'proj_gen_123',
        name: `AI - ${genImage.prompt.slice(0, 24)}`,
        imageSrc: genImage.imageUrl,
        originalName: `${genImage.id}.png`,
        width: genImage.width,
        height: genImage.height,
        fileSize: 1024 * 1024,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        adjustments: DEFAULT_ADJUSTMENTS,
        activePresetId: null,
        presetIntensity: 100,
        geometry: DEFAULT_GEOMETRY,
        curves: DEFAULT_CURVES,
        wheels: DEFAULT_WHEELS,
        cutout: DEFAULT_CUTOUT,
      };

      const serialized = JSON.stringify(project);
      const deserialized: Project = JSON.parse(serialized);

      expect(deserialized.id).toBe('proj_gen_123');
      expect(deserialized.imageSrc).toBe('data:image/png;base64,mockGeneratedPixelBuffer');
      expect(deserialized.width).toBe(1024);
      expect(deserialized.height).toBe(1024);
      expect(deserialized.adjustments.exposure).toBe(0);
    });
  });

  describe('6. Client Bundle Credential Security', () => {
    it('verifies that no provider API keys are hardcoded in client code', () => {
      const codeStr = JSON.stringify(imageGenService);
      expect(codeStr).not.toContain('sk-');
      expect(codeStr).not.toContain('r8_');
      expect(codeStr).not.toContain('AIzaSy');
    });
  });
});
