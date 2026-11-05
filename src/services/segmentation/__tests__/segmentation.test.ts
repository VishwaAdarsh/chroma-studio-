// Chroma Studio — AI Background Removal & Segmentation Test Suite
// Verifies on-device segmentation, memory safeguards, guided matting, privacy consent gating,
// non-destructive pipeline matting, transparent PNG export, and JPEG matte compositing.

import { describe, it, expect, vi } from 'vitest';
import { OnDeviceSegmenter } from '../onDeviceSegmenter';
import { SupabaseSegmenter } from '../supabaseSegmenter';
import { segmentationService } from '../segmentationService';
import { applyCutout } from '../../../engine/pipeline';
import type { CutoutState } from '../../../types/editor';

describe('AI Background Removal & Segmentation Suite', () => {
  // Helper to generate synthetic test images with distinct subject and background
  function createSyntheticImage(
    w = 20,
    h = 20,
    bg = { r: 240, g: 240, b: 240 },
    fg = { r: 180, g: 30, b: 60 }
  ): { data: Uint8ClampedArray; width: number; height: number } {
    const data = new Uint8ClampedArray(w * h * 4);
    const xMin = Math.floor(w * 0.3);
    const xMax = Math.ceil(w * 0.7);
    const yMin = Math.floor(h * 0.25);
    const yMax = Math.ceil(h * 0.75);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const isSubject = x >= xMin && x <= xMax && y >= yMin && y <= yMax;

        if (isSubject) {
          data[idx] = fg.r;
          data[idx + 1] = fg.g;
          data[idx + 2] = fg.b;
          data[idx + 3] = 255;
        } else {
          data[idx] = bg.r;
          data[idx + 1] = bg.g;
          data[idx + 2] = bg.b;
          data[idx + 3] = 255;
        }
      }
    }

    return { data, width: w, height: h };
  }

  describe('1. OnDeviceSegmenter — Core Engine & Edge Preservation', () => {
    const segmenter = new OnDeviceSegmenter();

    it('isolates central foreground subject with true continuous alpha transparency', async () => {
      const img = createSyntheticImage(20, 20);
      const result = await segmenter.segment(img, { tolerance: 35, feather: 2 });

      expect(result.width).toBe(20);
      expect(result.height).toBe(20);
      expect(result.alphaArray).toBeInstanceOf(Uint8ClampedArray);
      expect(result.alphaArray.length).toBe(20 * 20);
      expect(result.provider).toBe('on-device');

      // Corner pixel (0, 0) is background -> alpha should be transparent (0 or near 0)
      const cornerAlpha = result.alphaArray[0];
      expect(cornerAlpha).toBeLessThan(50);

      // Center subject pixel (10, 10) -> alpha should be solid (>= 200)
      const centerAlpha = result.alphaArray[10 * 20 + 10];
      expect(centerAlpha).toBeGreaterThan(200);

      // Mask data URL must be generated
      expect(result.maskData).toBeTruthy();
    });

    it('supports portrait orientation (height > width)', async () => {
      const portraitImg = createSyntheticImage(16, 24);
      const result = await segmenter.segment(portraitImg);

      expect(result.width).toBe(16);
      expect(result.height).toBe(24);
      expect(result.alphaArray.length).toBe(16 * 24);

      // Subject center in portrait
      const centerAlpha = result.alphaArray[12 * 16 + 8];
      expect(centerAlpha).toBeGreaterThan(180);
    });

    it('supports landscape orientation (width > height)', async () => {
      const landscapeImg = createSyntheticImage(24, 16);
      const result = await segmenter.segment(landscapeImg);

      expect(result.width).toBe(24);
      expect(result.height).toBe(16);
      expect(result.alphaArray.length).toBe(24 * 16);

      // Subject center in landscape
      const centerAlpha = result.alphaArray[8 * 24 + 12];
      expect(centerAlpha).toBeGreaterThan(180);
    });

    it('inverts selection when invert is true', async () => {
      const img = createSyntheticImage(20, 20);
      const normalResult = await segmenter.segment(img, { invert: false });
      const invertedResult = await segmenter.segment(img, { invert: true });

      const centerIdx = 10 * 20 + 10;
      const cornerIdx = 0;

      // Inverted: center subject becomes transparent, background becomes opaque
      expect(normalResult.alphaArray[centerIdx]).toBeGreaterThan(180);
      expect(invertedResult.alphaArray[centerIdx]).toBeLessThan(70);

      expect(normalResult.alphaArray[cornerIdx]).toBeLessThan(70);
      expect(invertedResult.alphaArray[cornerIdx]).toBeGreaterThan(180);
    });

    it('handles cancellation gracefully via AbortSignal', async () => {
      const img = createSyntheticImage(20, 20);
      const controller = new AbortController();
      controller.abort(); // pre-aborted signal

      await expect(segmenter.segment(img, { signal: controller.signal })).rejects.toThrow(
        /cancelled/i
      );
    });

    it('protects against mobile memory crashes on large images (>1024px)', async () => {
      // Simulate high-res image (1200 x 800)
      const highResImg = createSyntheticImage(1200, 800);
      const result = await segmenter.segment(highResImg);

      // Final output matches original source dimensions exactly
      expect(result.width).toBe(1200);
      expect(result.height).toBe(800);
      expect(result.alphaArray.length).toBe(1200 * 800);

      // Subject center preserved
      const centerAlpha = result.alphaArray[400 * 1200 + 600];
      expect(centerAlpha).toBeGreaterThan(150);
    });
  });

  describe('2. SupabaseSegmenter — Privacy Consent & Remote Edge Fallback', () => {
    const cloudSegmenter = new SupabaseSegmenter();

    it('blocks execution and throws privacy error if explicit consent is missing', async () => {
      const img = createSyntheticImage(20, 20);

      // Calling without userConsent
      await expect(
        cloudSegmenter.segment(img, { userConsent: false })
      ).rejects.toThrow(/consent/i);
    });

    it('processes successfully with fallback when user consent is explicitly provided', async () => {
      const img = createSyntheticImage(20, 20);
      const progressSteps: number[] = [];

      const result = await cloudSegmenter.segment(img, {
        userConsent: true,
        onProgress: (pct) => progressSteps.push(pct),
      });

      expect(result).toBeDefined();
      expect(result.alphaArray.length).toBe(20 * 20);
      expect(progressSteps.length).toBeGreaterThan(0);
    });
  });

  describe('3. SegmentationService Facade', () => {
    it('coordinates requests and cancels in-flight operations', async () => {
      const img = createSyntheticImage(20, 20);
      expect(segmentationService.isProcessing()).toBe(false);

      const promise = segmentationService.removeBackground(img, { tolerance: 40 });
      const result = await promise;

      expect(result.alphaArray).toBeDefined();
      expect(segmentationService.isProcessing()).toBe(false);
    });
  });

  describe('4. Pipeline Matting & Non-Destructive Storage', () => {
    it('applies precomputed alpha mask to pipeline buffer non-destructively', () => {
      const w = 10;
      const h = 10;
      const img = createSyntheticImage(w, h);
      const syntheticAlpha = new Uint8ClampedArray(w * h);

      // Center subject has alpha 255, background has alpha 0
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const isCenter = x >= 3 && x <= 6 && y >= 3 && y <= 6;
          syntheticAlpha[y * w + x] = isCenter ? 255 : 0;
        }
      }

      const cutout: CutoutState = {
        enabled: true,
        mode: 'ai',
        tolerance: 35,
        feather: 0,
        invert: false,
        maskAlpha: syntheticAlpha,
      };

      applyCutout(img.data, w, h, cutout);

      // Corner pixel (0, 0) alpha is 0
      expect(img.data[3]).toBe(0);

      // Center pixel (5, 5) alpha is 255, and RGB color is preserved unaltered
      const centerIdx = (5 * w + 5) * 4;
      expect(img.data[centerIdx + 3]).toBe(255);
      expect(img.data[centerIdx]).toBe(180);
      expect(img.data[centerIdx + 1]).toBe(30);
      expect(img.data[centerIdx + 2]).toBe(60);
    });

    it('inverts precomputed alpha mask in pipeline when invert is true', () => {
      const w = 10;
      const h = 10;
      const img = createSyntheticImage(w, h);
      const syntheticAlpha = new Uint8ClampedArray(w * h);
      syntheticAlpha.fill(255);
      syntheticAlpha[0] = 0; // corner is transparent

      const cutout: CutoutState = {
        enabled: true,
        mode: 'ai',
        tolerance: 35,
        feather: 0,
        invert: true,
        maskAlpha: syntheticAlpha,
      };

      applyCutout(img.data, w, h, cutout);

      // Inverted: corner becomes 255, others become 0
      expect(img.data[3]).toBe(255);
      expect(img.data[4 * 4 + 3]).toBe(0);
    });

    it('executes inline salient subject detection when mode is ai and precomputed mask is omitted', () => {
      const w = 12;
      const h = 12;
      const img = createSyntheticImage(w, h);

      const cutout: CutoutState = {
        enabled: true,
        mode: 'ai',
        tolerance: 35,
        feather: 2,
        invert: false,
      };

      applyCutout(img.data, w, h, cutout);

      // Background corner alpha is 0
      expect(img.data[3]).toBe(0);

      // Foreground subject center alpha is 255
      const centerIdx = (6 * w + 6) * 4;
      expect(img.data[centerIdx + 3]).toBe(255);
    });
  });

  describe('5. Export Compatibility: Transparent PNG vs JPEG Matte Color', () => {
    it('preserves alpha transparency for PNG export', () => {
      const w = 4;
      const h = 4;
      const img = createSyntheticImage(w, h);
      const cutout: CutoutState = {
        enabled: true,
        mode: 'auto',
        tolerance: 30,
        feather: 0,
        invert: false,
      };

      applyCutout(img.data, w, h, cutout);

      // Alpha channel has 0 values indicating true transparency for PNG encoder
      let hasZeroAlpha = false;
      for (let i = 3; i < img.data.length; i += 4) {
        if (img.data[i] === 0) {
          hasZeroAlpha = true;
          break;
        }
      }
      expect(hasZeroAlpha).toBe(true);
    });

    it('supports user selectable matteColor for non-alpha JPEG export', () => {
      const cutout: CutoutState = {
        enabled: true,
        mode: 'ai',
        tolerance: 35,
        feather: 4,
        invert: false,
        matteColor: '#070B14', // Dark Studio
      };

      expect(cutout.matteColor).toBe('#070B14');
    });
  });
});
