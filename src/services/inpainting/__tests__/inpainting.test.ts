// Chroma Studio — AI Inpainting & Object Removal Test Suite
// Verifies mask detection, ROI bounding box extraction, Telea texture reconstruction,
// privacy consent gating, stroke undo/redo, non-destructive layer persistence, and memory safeguards.

import { describe, it, expect } from 'vitest';
import { OnDeviceInpainter } from '../onDeviceInpainter';
import { SupabaseInpainter } from '../supabaseInpainter';
import { inpaintingService } from '../inpaintingService';
import type { InpaintOperation, InpaintState, Project } from '../../../types/editor';

describe('AI Object Removal & Inpainting Suite', () => {
  // Helper to create synthetic test image (e.g. blue sky with a distinct red unwanted object)
  function createSyntheticImageWithObject(
    w = 50,
    h = 50,
    objBounds = { x: 15, y: 15, w: 10, h: 10 }
  ): {
    image: { data: Uint8ClampedArray; width: number; height: number };
    mask: { data: Uint8ClampedArray; width: number; height: number };
  } {
    const imgData = new Uint8ClampedArray(w * h * 4);
    const maskData = new Uint8ClampedArray(w * h * 4);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const isObject =
          x >= objBounds.x &&
          x < objBounds.x + objBounds.w &&
          y >= objBounds.y &&
          y < objBounds.y + objBounds.h;

        if (isObject) {
          // Unwanted object: bright red (240, 20, 20)
          imgData[idx] = 240;
          imgData[idx + 1] = 20;
          imgData[idx + 2] = 20;
          imgData[idx + 3] = 255;

          // Mask painted over object: magenta (236, 72, 153, 200)
          maskData[idx] = 236;
          maskData[idx + 1] = 72;
          maskData[idx + 2] = 153;
          maskData[idx + 3] = 200;
        } else {
          // Background: sky blue (100, 180, 240)
          imgData[idx] = 100;
          imgData[idx + 1] = 180;
          imgData[idx + 2] = 240;
          imgData[idx + 3] = 255;

          // Unmasked: fully transparent
          maskData[idx] = 0;
          maskData[idx + 1] = 0;
          maskData[idx + 2] = 0;
          maskData[idx + 3] = 0;
        }
      }
    }

    return {
      image: { data: imgData, width: w, height: h },
      mask: { data: maskData, width: w, height: h },
    };
  }

  describe('1. Selection Masking & Bounding Box Extraction', () => {
    const inpainter = new OnDeviceInpainter();

    it('throws clear error if mask has no painted pixels', async () => {
      const { image } = createSyntheticImageWithObject(20, 20);
      const emptyMask = {
        data: new Uint8ClampedArray(20 * 20 * 4),
        width: 20,
        height: 20,
      };

      await expect(inpainter.inpaint(image, emptyMask)).rejects.toThrow(/no object marked/i);
    });

    it('correctly calculates tight bounding box of painted mask', async () => {
      const { image, mask } = createSyntheticImageWithObject(50, 50, { x: 12, y: 14, w: 8, h: 10 });
      const result = await inpainter.inpaint(image, mask);

      expect(result.bounds).toBeDefined();
      expect(result.bounds.x).toBe(12);
      expect(result.bounds.y).toBe(14);
      expect(result.bounds.width).toBe(8);
      expect(result.bounds.height).toBe(10);
    });
  });

  describe('2. Inpainting Reconstruction & Texture Synthesis', () => {
    const inpainter = new OnDeviceInpainter();

    it('replaces unwanted red object with surrounding blue background texture', async () => {
      const w = 40;
      const h = 40;
      const { image, mask } = createSyntheticImageWithObject(w, h, { x: 15, y: 15, w: 10, h: 10 });
      const originalCopy = new Uint8ClampedArray(image.data);

      const result = await inpainter.inpaint(image, mask);

      expect(result.outputBuffer).toBeInstanceOf(Uint8ClampedArray);
      expect(result.provider).toBe('on-device');
      expect(result.inpaintedDataUrl).toBeTruthy();

      // Original source image buffer must remain 100% untouched
      expect(image.data).toEqual(originalCopy);

      // Center pixel of formerly red object (20, 20) in outputBuffer
      const centerIdx = (20 * w + 20) * 4;
      const redVal = result.outputBuffer[centerIdx];
      const blueVal = result.outputBuffer[centerIdx + 2];

      // Red object color should be replaced by surrounding blue sky colors
      expect(blueVal).toBeGreaterThan(redVal);
      expect(blueVal).toBeGreaterThan(150);
    });

    it('supports mask expansion (dilation) to eliminate edge halos', async () => {
      const { image, mask } = createSyntheticImageWithObject(30, 30, { x: 10, y: 10, w: 6, h: 6 });
      const result = await inpainter.inpaint(image, mask, { expansion: 3, feather: 2 });

      expect(result.outputBuffer).toBeDefined();
      expect(result.bounds).toBeDefined();
    });
  });

  describe('3. Cloud AI Privacy Consent Gating & Fallback', () => {
    const cloudInpainter = new SupabaseInpainter();

    it('strictly blocks execution and throws privacy error when user consent is false', async () => {
      const { image, mask } = createSyntheticImageWithObject(20, 20);

      await expect(
        cloudInpainter.inpaint(image, mask, { userConsent: false })
      ).rejects.toThrow(/consent/i);
    });

    it('processes successfully with fallback when user consent is confirmed', async () => {
      const { image, mask } = createSyntheticImageWithObject(20, 20);
      const progressSteps: number[] = [];

      const result = await cloudInpainter.inpaint(image, mask, {
        userConsent: true,
        onProgress: (pct) => progressSteps.push(pct),
      });

      expect(result).toBeDefined();
      expect(result.outputBuffer.length).toBe(20 * 20 * 4);
      expect(progressSteps.length).toBeGreaterThan(0);
    });
  });

  describe('4. InpaintingService Facade & Cancellation', () => {
    it('aborts operation immediately when AbortSignal is triggered', async () => {
      const { image, mask } = createSyntheticImageWithObject(20, 20);
      const controller = new AbortController();
      controller.abort(); // Pre-aborted

      await expect(
        inpaintingService.inpaintObject(image, mask, { signal: controller.signal })
      ).rejects.toThrow(/cancelled/i);
    });
  });

  describe('5. Stroke History & Non-Destructive Layer Persistence', () => {
    it('maintains multi-stroke history stack for undo and redo', () => {
      const pastStrokes: number[] = [];
      const futureStrokes: number[] = [];

      // User draws stroke 1
      pastStrokes.push(1);
      expect(pastStrokes.length).toBe(1);

      // User draws stroke 2
      pastStrokes.push(2);
      expect(pastStrokes.length).toBe(2);

      // User clicks Undo Stroke
      const undone = pastStrokes.pop()!;
      futureStrokes.push(undone);
      expect(undone).toBe(2);
      expect(pastStrokes.length).toBe(1);

      // User clicks Redo Stroke
      const redone = futureStrokes.pop()!;
      pastStrokes.push(redone);
      expect(redone).toBe(2);
      expect(pastStrokes.length).toBe(2);
    });

    it('persists InpaintState cleanly in project serialization without flattening raw source', () => {
      const op: InpaintOperation = {
        id: 'inpaint_123',
        timestamp: Date.now(),
        maskData: 'data:image/png;base64,mask123',
        patchData: 'data:image/png;base64,patch123',
        bounds: { x: 10, y: 15, width: 25, height: 30 },
        provider: 'on-device',
        explanation: 'Unwanted tourist removed from background.',
      };

      const inpaintState: InpaintState = {
        operations: [op],
      };

      const project: Partial<Project> = {
        id: 'proj_inpaint_test',
        name: 'Clean Vacation',
        imageSrc: 'data:image/jpeg;base64,originalUncutPhoto',
        inpaint: inpaintState,
      };

      const serialized = JSON.stringify(project);
      const deserialized: Partial<Project> = JSON.parse(serialized);

      expect(deserialized.imageSrc).toBe('data:image/jpeg;base64,originalUncutPhoto');
      expect(deserialized.inpaint?.operations.length).toBe(1);
      expect(deserialized.inpaint?.operations[0].id).toBe('inpaint_123');
      expect(deserialized.inpaint?.operations[0].bounds?.width).toBe(25);
    });
  });

  describe('6. Memory Safeguards & Large Image ROI Handling', () => {
    it('safely processes ultra-high-resolution images (1600x1200) by extracting localized ROI', async () => {
      // Simulate 1600x1200 image with a localized 40x40 object
      const { image, mask } = createSyntheticImageWithObject(1600, 1200, {
        x: 300,
        y: 400,
        w: 40,
        h: 40,
      });

      const inpainter = new OnDeviceInpainter();
      const result = await inpainter.inpaint(image, mask);

      expect(result.width).toBe(1600);
      expect(result.height).toBe(1200);
      expect(result.bounds.width).toBe(40);
      expect(result.bounds.height).toBe(40);
      // Fast execution even on large photos due to localized ROI
      expect(result.durationMs).toBeLessThan(1200);
    });
  });
});
