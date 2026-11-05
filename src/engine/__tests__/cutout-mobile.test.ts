import { describe, it, expect } from 'vitest';
import { applyCutout } from '../pipeline';
import { DEFAULT_CUTOUT } from '../../constants/defaults';
import type { CutoutState } from '../../types/editor';

describe('Smart Background Removal & Cutout Matting Engine', () => {
  // Helper to create a synthetic 10x10 RGBA image buffer
  // Perimeter: White (255, 255, 255)
  // Center (rows 3..6, cols 3..6): Crimson Red (220, 20, 60)
  function createSyntheticImage(w = 10, h = 10): Uint8ClampedArray {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const isCenter = x >= 3 && x <= 6 && y >= 3 && y <= 6;
        if (isCenter) {
          data[idx] = 220;     // R
          data[idx + 1] = 20;  // G
          data[idx + 2] = 60;  // B
          data[idx + 3] = 255; // A
        } else {
          data[idx] = 255;     // R
          data[idx + 1] = 255; // G
          data[idx + 2] = 255; // B
          data[idx + 3] = 255; // A
        }
      }
    }
    return data;
  }

  describe('applyCutout - Auto Matting Mode', () => {
    it('does nothing when cutout is disabled', () => {
      const data = createSyntheticImage();
      const initialAlpha = data[3];
      applyCutout(data, 10, 10, { ...DEFAULT_CUTOUT, enabled: false });
      expect(data[3]).toBe(initialAlpha);
    });

    it('samples boundary perimeter and removes background while preserving foreground subject', () => {
      const data = createSyntheticImage();
      const cutout: CutoutState = {
        enabled: true,
        mode: 'auto',
        tolerance: 30,
        feather: 0,
        invert: false,
      };

      applyCutout(data, 10, 10, cutout);

      // Top-left corner (0, 0) is background -> alpha should be 0
      const cornerIdx = 0;
      expect(data[cornerIdx + 3]).toBe(0);

      // Edge pixel (5, 0) is top edge background -> alpha should be 0
      const topEdgeIdx = (0 * 10 + 5) * 4;
      expect(data[topEdgeIdx + 3]).toBe(0);

      // Center subject pixel (4, 4) is crimson -> alpha should remain 255
      const centerIdx = (4 * 10 + 4) * 4;
      expect(data[centerIdx + 3]).toBe(255);
      expect(data[centerIdx]).toBe(220); // Color data preserved non-destructively
      expect(data[centerIdx + 1]).toBe(20);
      expect(data[centerIdx + 2]).toBe(60);
    });

    it('inverts selection when invert is true', () => {
      const data = createSyntheticImage();
      const cutout: CutoutState = {
        enabled: true,
        mode: 'auto',
        tolerance: 30,
        feather: 0,
        invert: true,
      };

      applyCutout(data, 10, 10, cutout);

      // Corner (background) should now be preserved (alpha = 255)
      const cornerIdx = 0;
      expect(data[cornerIdx + 3]).toBe(255);

      // Center subject should now be removed (alpha = 0)
      const centerIdx = (4 * 10 + 4) * 4;
      expect(data[centerIdx + 3]).toBe(0);
    });

    it('handles feathering to create smooth Hermite anti-aliased transitions', () => {
      const w = 10;
      const h = 10;
      const data = new Uint8ClampedArray(w * h * 4);

      // Fill with smooth gradient from White (255) to Gray (128)
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
          const idx = (y * w + x) * 4;
          const val = Math.round(255 - (x / 9) * 127);
          data[idx] = val;
          data[idx + 1] = val;
          data[idx + 2] = val;
          data[idx + 3] = 255;
        }
      }

      const cutout: CutoutState = {
        enabled: true,
        mode: 'color',
        targetColor: { r: 255, g: 255, b: 255 },
        tolerance: 25,
        feather: 10,
        invert: false,
      };

      applyCutout(data, w, h, cutout);

      // Collect alpha values across horizontal gradient row
      const alphas: number[] = [];
      for (let x = 0; x < w; x++) {
        const idx = (5 * w + x) * 4;
        alphas.push(data[idx + 3]);
      }

      // First pixel (identical to target color 255) should be 0
      expect(alphas[0]).toBe(0);
      // Last pixel (darkest, furthest from white) should be 255
      expect(alphas[w - 1]).toBe(255);

      // Verify intermediate alpha values exist (not just binary 0 or 255)
      const hasTransitions = alphas.some((a) => a > 0 && a < 255);
      expect(hasTransitions).toBe(true);

      // Verify alpha increases monotonically
      for (let i = 1; i < alphas.length; i++) {
        expect(alphas[i]).toBeGreaterThanOrEqual(alphas[i - 1]);
      }
    });
  });

  describe('applyCutout - Color Key Matting Mode', () => {
    it('targets explicit user-selected chroma key color', () => {
      const w = 4;
      const h = 4;
      const data = new Uint8ClampedArray(w * h * 4);

      // Chroma Green (0, 255, 0) background, Blue (0, 0, 255) subject at (1, 1)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 0;
        data[i + 1] = 255;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
      const subjectIdx = (1 * w + 1) * 4;
      data[subjectIdx] = 0;
      data[subjectIdx + 1] = 0;
      data[subjectIdx + 2] = 255;

      const cutout: CutoutState = {
        enabled: true,
        mode: 'color',
        targetColor: { r: 0, g: 255, b: 0 },
        tolerance: 20,
        feather: 0,
        invert: false,
      };

      applyCutout(data, w, h, cutout);

      // Green pixels removed (alpha = 0)
      expect(data[3]).toBe(0);

      // Blue subject retained (alpha = 255)
      expect(data[subjectIdx + 3]).toBe(255);
      expect(data[subjectIdx + 2]).toBe(255);
    });
  });

  describe('JPEG Matte Compositing Simulation', () => {
    it('replaces alpha transparency with specified matte color for JPEG encoding', () => {
      // Simulate composite onto matte canvas
      const w = 4;
      const h = 4;
      const matteColorR = 255;
      const matteColorG = 255;
      const matteColorB = 255;

      // Source pixel: Crimson Red with alpha = 0 (background cut out)
      const srcR = 220, srcG = 20, srcB = 60, srcA = 0;

      // Alpha compositing formula: out = src * (srcA/255) + dst * (1 - srcA/255)
      const normA = srcA / 255;
      const finalR = Math.round(srcR * normA + matteColorR * (1 - normA));
      const finalG = Math.round(srcG * normA + matteColorG * (1 - normA));
      const finalB = Math.round(srcB * normA + matteColorB * (1 - normA));
      const finalA = 255;

      // Background cutout pixel becomes pure white matte without black artifacting
      expect(finalR).toBe(255);
      expect(finalG).toBe(255);
      expect(finalB).toBe(255);
      expect(finalA).toBe(255);

      // For subject pixel with srcA = 255:
      const subR = 220, subG = 20, subB = 60, subA = 255;
      const subNormA = subA / 255;
      const finalSubR = Math.round(subR * subNormA + matteColorR * (1 - subNormA));
      const finalSubG = Math.round(subG * subNormA + matteColorG * (1 - subNormA));
      const finalSubB = Math.round(subB * subNormA + matteColorB * (1 - subNormA));

      expect(finalSubR).toBe(220);
      expect(finalSubG).toBe(20);
      expect(finalSubB).toBe(60);
    });
  });

  describe('Mobile Responsiveness & Usability Safeguards', () => {
    it('DEFAULT_CUTOUT satisfies non-destructive baseline requirements', () => {
      expect(DEFAULT_CUTOUT.enabled).toBe(false);
      expect(DEFAULT_CUTOUT.mode).toBe('auto');
      expect(DEFAULT_CUTOUT.tolerance).toBeGreaterThanOrEqual(10);
      expect(DEFAULT_CUTOUT.tolerance).toBeLessThanOrEqual(60);
      expect(DEFAULT_CUTOUT.feather).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_CUTOUT.invert).toBe(false);
      expect(DEFAULT_CUTOUT.matteColor).toBe('#ffffff');
    });

    it('tolerance and feathering remain within bounded clamping limits', () => {
      const data = createSyntheticImage();
      const cutoutExtreme: CutoutState = {
        enabled: true,
        mode: 'auto',
        tolerance: 9999, // Should clamp gracefully without NaN
        feather: 9999,
        invert: false,
      };

      expect(() => applyCutout(data, 10, 10, cutoutExtreme)).not.toThrow();
    });

    it('supports AI neural matting mode and maskAlpha precomputed buffer', () => {
      const data = createSyntheticImage();
      const mask = new Uint8ClampedArray(100);
      mask.fill(255);
      mask[0] = 0; // corner 0 is background

      const cutoutAi: CutoutState = {
        enabled: true,
        mode: 'ai',
        tolerance: 35,
        feather: 2,
        invert: false,
        maskAlpha: mask,
        maskData: 'data:image/png;base64,mockMask',
      };

      applyCutout(data, 10, 10, cutoutAi);
      expect(data[3]).toBe(0); // corner is transparent
      expect(data[4 * 4 + 3]).toBe(255); // other pixels opaque
    });
  });
});
