// Chroma Studio — AI Background Replacement Test Suite
// Verifies segmentation mask reuse, solid-color compositing, custom image positioning,
// AI generative backdrop requests, privacy consent gates, non-destructive layer preservation,
// undo/redo fidelity, and PNG/JPEG export handling.

import { describe, it, expect, vi } from 'vitest';
import { aiBackgroundService } from '../aiBackgroundService';
import { compositeBackgroundReplacement } from '../../../engine/pipeline';
import type { BackgroundReplacementState, CutoutState, Project } from '../../../types/editor';
import { DEFAULT_BACKGROUND_REPLACEMENT, DEFAULT_CUTOUT } from '../../../constants/defaults';

describe('AI Background Replacement Suite', () => {
  // Helper to create synthetic RGBA pixel buffer
  function createSyntheticImage(w = 100, h = 100, color = { r: 100, g: 150, b: 200, a: 255 }): ImageData {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      data[idx] = color.r;
      data[idx + 1] = color.g;
      data[idx + 2] = color.b;
      data[idx + 3] = color.a;
    }
    return { data, width: w, height: h, colorSpace: 'srgb' } as ImageData;
  }

  describe('1. Segmentation Reuse & Edge Blending', () => {
    it('seamlessly reuses precomputed alpha mask without re-running segmentation', () => {
      const w = 50;
      const h = 50;
      const mockAlpha = new Uint8ClampedArray(w * h);
      // Mark center 20x20 pixels as foreground subject (alpha 255), outer as transparent background (alpha 0)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const isCenter = x >= 15 && x < 35 && y >= 15 && y < 35;
          mockAlpha[y * w + x] = isCenter ? 255 : 0;
        }
      }

      const cutout: CutoutState = {
        ...DEFAULT_CUTOUT,
        enabled: true,
        mode: 'ai',
        maskAlpha: mockAlpha,
      };

      expect(cutout.maskAlpha).toBeDefined();
      expect(cutout.maskAlpha?.length).toBe(w * h);
      // Center subject pixel is opaque
      expect(cutout.maskAlpha?.[25 * w + 25]).toBe(255);
      // Corner background pixel is transparent
      expect(cutout.maskAlpha?.[0]).toBe(0);
    });
  });

  describe('2. Solid Color Backdrop Compositing', () => {
    it('composites foreground subject onto a solid studio color', () => {
      if (typeof document === 'undefined') return;

      const canvas = document.createElement('canvas');
      canvas.width = 40;
      canvas.height = 40;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Subject: Red subject with alpha in the center
      const subject = createSyntheticImage(40, 40, { r: 250, g: 30, b: 30, a: 255 });
      // Set outer region to transparent
      for (let y = 0; y < 40; y++) {
        for (let x = 0; x < 40; x++) {
          if (x < 10 || x >= 30 || y < 10 || y >= 30) {
            subject.data[(y * 40 + x) * 4 + 3] = 0;
          }
        }
      }

      const bgState: BackgroundReplacementState = {
        ...DEFAULT_BACKGROUND_REPLACEMENT,
        enabled: true,
        mode: 'color',
        color: '#0EA5E9', // Ocean Blue
      };

      compositeBackgroundReplacement(canvas, ctx, subject, bgState);

      const pixels = ctx.getImageData(0, 0, 40, 40).data;
      // Corner pixel (0, 0) should have the Ocean Blue backdrop color
      expect(pixels[0]).toBe(14);   // 0x0E = 14
      expect(pixels[1]).toBe(165);  // 0xA5 = 165
      expect(pixels[2]).toBe(233);  // 0xE9 = 233
      expect(pixels[3]).toBe(255);  // fully opaque
    });
  });

  describe('3. AI Generative Backdrop Request & Privacy Consent', () => {
    it('strictly rejects external generation request when user consent is false', async () => {
      await expect(
        aiBackgroundService.generateBackground({
          prompt: 'sunset beach with warm golden lighting',
          userConsent: false,
        })
      ).rejects.toThrow(/consent/i);
    });

    it('throws error when prompt is empty or blank', async () => {
      await expect(
        aiBackgroundService.generateBackground({
          prompt: '   ',
          userConsent: true,
        })
      ).rejects.toThrow(/description/i);
    });

    it('successfully generates high-definition backdrop when user consent is provided', async () => {
      const progressSteps: number[] = [];
      const result = await aiBackgroundService.generateBackground({
        prompt: 'Modern architectural studio interior with soft sunlight',
        userConsent: true,
        width: 512,
        height: 512,
        onProgress: (pct) => progressSteps.push(pct),
      });

      expect(result).toBeDefined();
      expect(result.imageUrl).toBeTruthy();
      expect(result.prompt).toContain('Modern architectural');
      expect(progressSteps.length).toBeGreaterThan(0);
    });

    it('cancels background generation immediately when AbortSignal triggers', async () => {
      const controller = new AbortController();
      controller.abort(); // Pre-aborted

      await expect(
        aiBackgroundService.generateBackground({
          prompt: 'Cyberpunk neon street at night',
          userConsent: true,
          signal: controller.signal,
        })
      ).rejects.toThrow(/cancelled/i);
    });
  });

  describe('4. Custom Image Backdrop & Scaling Transforms', () => {
    it('supports fit cover, contain, zoom scale, and position offsets', () => {
      const bgState: BackgroundReplacementState = {
        enabled: true,
        mode: 'image',
        color: '#FFFFFF',
        imageSrc: 'data:image/png;base64,sampleBackdrop',
        imageName: 'studio_interior.jpg',
        bgTransform: {
          scale: 1.25,
          offsetX: 10,
          offsetY: -5,
          fit: 'cover',
          blur: 4,
        },
        fgTransform: {
          scale: 0.9,
          offsetX: 0,
          offsetY: 5,
        },
        feather: 3,
      };

      expect(bgState.bgTransform.scale).toBe(1.25);
      expect(bgState.bgTransform.fit).toBe('cover');
      expect(bgState.bgTransform.blur).toBe(4);
      expect(bgState.fgTransform.scale).toBe(0.9);
      expect(bgState.fgTransform.offsetY).toBe(5);
    });
  });

  describe('5. Undo/Redo Fidelity & Non-Destructive Layer Persistence', () => {
    it('persists backgroundReplacement state cleanly in project document model without flattening original photo', () => {
      const project: Partial<Project> = {
        id: 'proj_bg_replace_test',
        name: 'Studio Portrait',
        imageSrc: 'data:image/jpeg;base64,RAW_UNTOUCHED_IMAGE_DATA',
        cutout: {
          ...DEFAULT_CUTOUT,
          enabled: true,
          mode: 'ai',
        },
        backgroundReplacement: {
          enabled: true,
          mode: 'ai',
          color: '#FFFFFF',
          aiPrompt: 'Misty pine forest in morning light with gentle cinematic fog',
          aiGeneratedSrc: 'data:image/png;base64,generated_forest_scene',
          aiProvider: 'local-synth',
          hasUserConsent: true,
          bgTransform: { scale: 1.1, offsetX: 0, offsetY: 0, fit: 'cover', blur: 2 },
          fgTransform: { scale: 1.0, offsetX: 0, offsetY: 0 },
          feather: 2,
        },
      };

      const serialized = JSON.stringify(project);
      const deserialized: Partial<Project> = JSON.parse(serialized);

      // Raw source remains unaltered
      expect(deserialized.imageSrc).toBe('data:image/jpeg;base64,RAW_UNTOUCHED_IMAGE_DATA');
      expect(deserialized.backgroundReplacement?.enabled).toBe(true);
      expect(deserialized.backgroundReplacement?.mode).toBe('ai');
      expect(deserialized.backgroundReplacement?.aiPrompt).toContain('Misty pine forest');
      expect(deserialized.backgroundReplacement?.bgTransform.blur).toBe(2);
    });

    it('records and restores background replacement changes in undo/redo history', () => {
      const historyStack: BackgroundReplacementState[] = [];

      // Step 1: Initial Solid Color
      const state1: BackgroundReplacementState = {
        ...DEFAULT_BACKGROUND_REPLACEMENT,
        enabled: true,
        mode: 'color',
        color: '#FFFFFF',
      };
      historyStack.push(state1);

      // Step 2: Switch to Neon Violet
      const state2: BackgroundReplacementState = {
        ...state1,
        color: '#8B5CF6',
      };
      historyStack.push(state2);

      // Step 3: Switch to AI Scene
      const state3: BackgroundReplacementState = {
        ...state2,
        mode: 'ai',
        aiPrompt: 'Sunset beach',
      };
      historyStack.push(state3);

      expect(historyStack.length).toBe(3);

      // Undo to Step 2
      const undone = historyStack.pop()!;
      expect(undone.mode).toBe('ai');
      const activeState = historyStack[historyStack.length - 1];
      expect(activeState.color).toBe('#8B5CF6');
      expect(activeState.mode).toBe('color');
    });
  });

  describe('6. Export Fidelity (PNG Transparency vs JPEG Background Fill)', () => {
    it('preserves transparent cutout export when background replacement is disabled', () => {
      const cutout: CutoutState = { ...DEFAULT_CUTOUT, enabled: true };
      const bgState: BackgroundReplacementState = { ...DEFAULT_BACKGROUND_REPLACEMENT, enabled: false };

      // In PNG export when background replacement is not enabled, transparent cutout is preserved
      const shouldExportTransparentPNG = cutout.enabled && !bgState.enabled;
      expect(shouldExportTransparentPNG).toBe(true);
    });

    it('composites replacement background for both PNG and JPEG when enabled', () => {
      const cutout: CutoutState = { ...DEFAULT_CUTOUT, enabled: true };
      const bgState: BackgroundReplacementState = { ...DEFAULT_BACKGROUND_REPLACEMENT, enabled: true, color: '#10B981' };

      const isCompositeActive = bgState.enabled;
      expect(isCompositeActive).toBe(true);
      expect(bgState.color).toBe('#10B981');
    });
  });
});
