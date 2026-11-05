import { describe, it, expect } from 'vitest';
import {
  calculateAutoTone,
  applyNoiseReduction,
  applyHsl,
  blendPresetAdjustments,
  rgbToHsl,
} from '../pipeline';
import { DEFAULT_ADJUSTMENTS, DEFAULT_HSL } from '../../constants/defaults';
import type { HistogramData, HslAdjustments, Preset } from '../../types/editor';

describe('Photo Editor Improvements & Professional Tool Suite', () => {
  describe('calculateAutoTone (Scientific Histogram Analysis)', () => {
    it('returns original adjustments if histogram is empty or zero', () => {
      const emptyHist: HistogramData = {
        r: new Array(256).fill(0),
        g: new Array(256).fill(0),
        b: new Array(256).fill(0),
        l: new Array(256).fill(0),
        maxCount: 1,
      };

      const result = calculateAutoTone(emptyHist, DEFAULT_ADJUSTMENTS);
      expect(result).toEqual(DEFAULT_ADJUSTMENTS);

      const nullResult = calculateAutoTone(null, DEFAULT_ADJUSTMENTS);
      expect(nullResult).toEqual(DEFAULT_ADJUSTMENTS);
    });

    it('boosts exposure and lifts shadows on dark/underexposed images', () => {
      // Create a histogram with all pixels clustered between 10 and 40 (very dark)
      const darkHist: HistogramData = {
        r: new Array(256).fill(0),
        g: new Array(256).fill(0),
        b: new Array(256).fill(0),
        l: new Array(256).fill(0),
        maxCount: 100,
      };
      for (let i = 10; i <= 40; i++) {
        darkHist.l[i] = 100;
        darkHist.r[i] = 100;
        darkHist.g[i] = 100;
        darkHist.b[i] = 100;
      }

      const auto = calculateAutoTone(darkHist, DEFAULT_ADJUSTMENTS);
      expect(auto.exposure).toBeGreaterThan(0.5); // Should lift exposure
      expect(auto.shadows).toBeGreaterThan(10);   // Should lift shadows
      expect(auto.clarity).toBe(12);
      expect(auto.vibrance).toBe(14);
    });

    it('pulls exposure and pulls highlights on bright/overexposed images', () => {
      // Create a histogram with all pixels clustered between 220 and 255 (blown highlights)
      const brightHist: HistogramData = {
        r: new Array(256).fill(0),
        g: new Array(256).fill(0),
        b: new Array(256).fill(0),
        l: new Array(256).fill(0),
        maxCount: 100,
      };
      for (let i = 220; i <= 255; i++) {
        brightHist.l[i] = 100;
        brightHist.r[i] = 100;
        brightHist.g[i] = 100;
        brightHist.b[i] = 100;
      }

      const auto = calculateAutoTone(brightHist, DEFAULT_ADJUSTMENTS);
      expect(auto.exposure).toBeLessThan(0);       // Should lower exposure
      expect(auto.highlights).toBeLessThan(-10);   // Should pull highlights back
    });

    it('enhances contrast on flat/low-dynamic-range histograms', () => {
      // Low dynamic range: all pixels clustered around 120-135
      const flatHist: HistogramData = {
        r: new Array(256).fill(0),
        g: new Array(256).fill(0),
        b: new Array(256).fill(0),
        l: new Array(256).fill(0),
        maxCount: 100,
      };
      for (let i = 120; i <= 135; i++) {
        flatHist.l[i] = 100;
        flatHist.r[i] = 100;
        flatHist.g[i] = 100;
        flatHist.b[i] = 100;
      }

      const auto = calculateAutoTone(flatHist, DEFAULT_ADJUSTMENTS);
      expect(auto.contrast).toBeGreaterThan(15); // Should significantly boost contrast
    });

    it('corrects color cast using gray world temperature and tint', () => {
      // Strong blue cast: Red is low, Blue is very high
      const blueCastHist: HistogramData = {
        r: new Array(256).fill(0),
        g: new Array(256).fill(0),
        b: new Array(256).fill(0),
        l: new Array(256).fill(0),
        maxCount: 100,
      };
      for (let i = 0; i < 256; i++) {
        blueCastHist.l[i] = 50;
        blueCastHist.r[i] = i < 80 ? 100 : 0;   // Dark red
        blueCastHist.g[i] = 50;                 // Neutral green
        blueCastHist.b[i] = i > 180 ? 100 : 0;  // High blue
      }

      const auto = calculateAutoTone(blueCastHist, DEFAULT_ADJUSTMENTS);
      // Because blue > red, temperature delta should be positive to warm up the image
      expect(auto.temperature).toBeGreaterThan(5);
    });
  });

  describe('applyNoiseReduction (Edge-Preserving Bilateral Filter)', () => {
    it('does nothing when amount is 0', () => {
      const buffer = new Uint8ClampedArray([100, 100, 100, 255, 120, 120, 120, 255]);
      const copy = new Uint8ClampedArray(buffer);
      applyNoiseReduction(buffer, 2, 1, 0);
      expect(buffer).toEqual(copy);
    });

    it('smooths noise in uniform regions while preserving edge contrast', () => {
      // 3x3 pixel grid: Left column = ~50 (dark edge), Right two columns = ~200 with noise (+-10)
      const w = 3;
      const h = 3;
      const data = new Uint8ClampedArray(w * h * 4);

      for (let y = 0; y < h; y++) {
        // x = 0 (sharp dark border)
        const idx0 = (y * w + 0) * 4;
        data[idx0] = 30; data[idx0 + 1] = 30; data[idx0 + 2] = 30; data[idx0 + 3] = 255;

        // x = 1 (bright area pixel with noise)
        const idx1 = (y * w + 1) * 4;
        data[idx1] = 210; data[idx1 + 1] = 210; data[idx1 + 2] = 210; data[idx1 + 3] = 255;

        // x = 2 (bright area pixel with noise)
        const idx2 = (y * w + 2) * 4;
        data[idx2] = 190; data[idx2 + 1] = 190; data[idx2 + 2] = 190; data[idx2 + 3] = 255;
      }

      applyNoiseReduction(data, w, h, 80);

      // The center bright pixel (1, 1) was 210, should smooth towards the neighbor 190
      const centerBrightIdx = (1 * w + 1) * 4;
      expect(data[centerBrightIdx]).toBeLessThan(210);
      expect(data[centerBrightIdx]).toBeGreaterThan(190);

      // The edge pixel (1, 0) was 30; bilateral weight should NOT drag it up to 200
      const edgeIdx = (1 * w + 0) * 4;
      expect(data[edgeIdx]).toBeLessThan(60); // Edge remains preserved
    });
  });

  describe('applyHsl (8-Channel Color Isolation)', () => {
    it('accurately identifies and transforms target color band without affecting others', () => {
      // 2 pixels: Pixel 0 = Pure Blue (0, 0, 255), Pixel 1 = Pure Red (255, 0, 0)
      const data = new Uint8ClampedArray([
        0, 0, 255, 255, // Blue
        255, 0, 0, 255, // Red
      ]);

      const hslAdjustments: HslAdjustments = {
        ...DEFAULT_HSL,
        blue: { hue: 0, saturation: -100, luminance: 0 }, // Completely desaturate blue
      };

      applyHsl(data, hslAdjustments);

      // Pixel 0 (Blue) should be desaturated (R, G, B become equal or near-gray)
      expect(data[0]).toBeGreaterThan(50); // Red channel lifted in desaturation
      expect(data[1]).toBeGreaterThan(50); // Green channel lifted in desaturation
      expect(data[2]).toBeLessThan(200);   // Blue channel pulled down

      // Pixel 1 (Red) should remain vibrant red with no blue crosstalk
      expect(data[4]).toBe(255);
      expect(data[5]).toBe(0);
      expect(data[6]).toBe(0);
    });

    it('preserves neutral gray and black pixels from chromatic artifacts', () => {
      // Neutral gray pixel (128, 128, 128)
      const data = new Uint8ClampedArray([128, 128, 128, 255]);
      const hslAdjustments: HslAdjustments = {
        ...DEFAULT_HSL,
        red: { hue: 50, saturation: 100, luminance: 50 },
        blue: { hue: -50, saturation: 100, luminance: -50 },
      };

      applyHsl(data, hslAdjustments);
      // Should remain exactly neutral (saturation < 0.03 skips HSL shift)
      expect(data[0]).toBe(128);
      expect(data[1]).toBe(128);
      expect(data[2]).toBe(128);
    });
  });

  describe('blendPresetAdjustments with HSL support', () => {
    it('blends HSL channel adjustments according to preset intensity factor', () => {
      const preset: Preset = {
        id: 'test-vibrant-greens',
        name: 'Vibrant Greens',
        category: 'Cinematic',
        tags: ['green'],
        defaultIntensity: 100,
        description: 'Boost green saturation',
        parameters: { exposure: 0.2 },
        hsl: {
          ...DEFAULT_HSL,
          green: { hue: 10, saturation: 60, luminance: 20 },
        },
      };

      // 50% intensity
      const blended50 = blendPresetAdjustments(
        DEFAULT_ADJUSTMENTS,
        preset,
        50,
        undefined,
        undefined,
        DEFAULT_HSL
      );

      expect(blended50.adjustments.exposure).toBeCloseTo(0.1, 2);
      expect(blended50.hsl?.green.saturation).toBe(30);
      expect(blended50.hsl?.green.hue).toBe(5);
      expect(blended50.hsl?.green.luminance).toBe(10);

      // 0% intensity
      const blended0 = blendPresetAdjustments(
        DEFAULT_ADJUSTMENTS,
        preset,
        0,
        undefined,
        undefined,
        DEFAULT_HSL
      );
      expect(blended0.hsl?.green.saturation).toBe(0);
    });
  });

  describe('rgbToHsl Conversion Utility', () => {
    it('accurately converts primary and secondary colors', () => {
      const [hRed, sRed, lRed] = rgbToHsl(255, 0, 0);
      expect(hRed).toBe(0);
      expect(sRed).toBe(1);
      expect(lRed).toBe(0.5);

      const [hGreen, sGreen, lGreen] = rgbToHsl(0, 255, 0);
      expect(hGreen).toBe(120);
      expect(sGreen).toBe(1);
      expect(lGreen).toBe(0.5);

      const [hBlue, sBlue, lBlue] = rgbToHsl(0, 0, 255);
      expect(hBlue).toBe(240);
      expect(sBlue).toBe(1);
      expect(lBlue).toBe(0.5);
    });
  });
});
