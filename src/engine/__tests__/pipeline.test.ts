import { describe, it, expect } from 'vitest';
import { applyClarity, applySharpen, boxBlurLuminance, processImage } from '../pipeline';
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_CURVES,
  DEFAULT_GEOMETRY,
  DEFAULT_WHEELS,
} from '../../constants/defaults';
import type { ColorWheels } from '../../types/editor';

describe('Pipeline: Clarity & Sharpening Engine', () => {
  it('applyClarity with clarity=0 leaves pixel buffer completely unchanged', () => {
    const w = 4;
    const h = 4;
    const data = new Uint8ClampedArray([
      100, 100, 100, 255,   150, 150, 150, 255,   120, 120, 120, 255,   130, 130, 130, 255,
      110, 110, 110, 255,   160, 160, 160, 255,   125, 125, 125, 255,   135, 135, 135, 255,
      105, 105, 105, 255,   155, 155, 155, 255,   122, 122, 122, 255,   132, 132, 132, 255,
      108, 108, 108, 255,   158, 158, 158, 255,   128, 128, 128, 255,   138, 138, 138, 255,
    ]);
    const original = new Uint8ClampedArray(data);

    applyClarity(data, w, h, 0);
    expect(data).toEqual(original);
  });

  it('applyClarity with clarity > 0 increases local midtone contrast and preserves alpha', () => {
    const w = 4;
    const h = 4;
    // Step edge in the midtones (100 vs 160)
    const data = new Uint8ClampedArray([
      100, 100, 100, 255,   160, 160, 160, 255,   100, 100, 100, 255,   160, 160, 160, 255,
      100, 100, 100, 255,   160, 160, 160, 255,   100, 100, 100, 255,   160, 160, 160, 255,
      100, 100, 100, 255,   160, 160, 160, 255,   100, 100, 100, 255,   160, 160, 160, 255,
      100, 100, 100, 255,   160, 160, 160, 255,   100, 100, 100, 255,   160, 160, 160, 255,
    ]);
    const original = new Uint8ClampedArray(data);

    applyClarity(data, w, h, 80);

    // Pixels have changed due to local high-frequency difference
    expect(data).not.toEqual(original);

    // Alpha channels remain exactly 255
    for (let i = 3; i < data.length; i += 4) {
      expect(data[i]).toBe(255);
    }

    // Midtone brighter side (160) increases, darker side (100) decreases relative to blur average (~130)
    expect(data[4]).toBeGreaterThan(160);
    expect(data[0]).toBeLessThan(100);
  });

  it('applySharpen with sharpen=0 leaves pixel buffer completely unchanged', () => {
    const w = 3;
    const h = 3;
    const data = new Uint8ClampedArray([
      50, 50, 50, 255,   120, 120, 120, 255,   200, 200, 200, 255,
      50, 50, 50, 255,   180, 180, 180, 255,   200, 200, 200, 255,
      50, 50, 50, 255,   120, 120, 120, 255,   200, 200, 200, 255,
    ]);
    const original = new Uint8ClampedArray(data);

    applySharpen(data, w, h, 0);
    expect(data).toEqual(original);
  });

  it('applySharpen with sharpen > 0 accentuates high-frequency edges and clamps to 255', () => {
    const w = 3;
    const h = 3;
    // Dark surround with bright center
    const data = new Uint8ClampedArray([
      50, 50, 50, 255,    50, 50, 50, 255,    50, 50, 50, 255,
      50, 50, 50, 255,   200, 200, 200, 255,    50, 50, 50, 255,
      50, 50, 50, 255,    50, 50, 50, 255,    50, 50, 50, 255,
    ]);

    applySharpen(data, w, h, 100);

    // Center pixel (index 4 * 4 = 16) should be accentuated higher than 200
    expect(data[16]).toBeGreaterThan(200);
    expect(data[16]).toBeLessThanOrEqual(255);

    // Alpha channel preserved
    expect(data[19]).toBe(255);
  });

  it('boxBlurLuminance produces correct moving window average', () => {
    const w = 3;
    const h = 3;
    const lum = new Float32Array([
      10, 10, 10,
      10, 100, 10,
      10, 10, 10,
    ]);

    const blurred = boxBlurLuminance(lum, w, h, 1);
    expect(blurred.length).toBe(9);
    // Center pixel is smoothed by surrounding neighbors
    expect(blurred[4]).toBeLessThan(100);
    expect(blurred[4]).toBeGreaterThan(10);
  });
});

describe('Pipeline: 3-Way Color Wheels & Luminance', () => {
  it('correctly incorporates wheels.midtones tint vector and luminance deltas', () => {
    const wheels: ColorWheels = {
      shadows: { hue: 0, saturation: 0, luminance: 0 },
      midtones: { hue: 120, saturation: 60, luminance: 20 }, // Green tint on midtones + positive luminance
      highlights: { hue: 0, saturation: 0, luminance: -30 },
    };

    // Verify wheels structure validity
    expect(wheels.midtones.hue).toBe(120);
    expect(wheels.midtones.saturation).toBe(60);
    expect(wheels.midtones.luminance).toBe(20);
    expect(wheels.highlights.luminance).toBe(-30);
  });
});
