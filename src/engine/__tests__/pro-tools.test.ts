import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_CURVES,
  DEFAULT_GEOMETRY,
  DEFAULT_WHEELS,
} from '../../constants/defaults';
import {
  applyColorWheels,
  applyCurves,
  buildCurveLUT,
  processImage,
} from '../pipeline';
import type { ColorWheels, GeometryState, ToneCurves } from '../../types/editor';

describe('Phase 3: Professional Editing Tools Suite', () => {
  // 1. Interactive Tone Curves
  describe('Tone Curves Engine & Constraints', () => {
    it('generates a 256-element LUT from linear default endpoints', () => {
      const lut = buildCurveLUT(DEFAULT_CURVES.rgb);
      expect(lut.length).toBe(256);
      expect(lut[0]).toBe(0);
      expect(lut[255]).toBe(255);
      expect(lut[128]).toBe(128);
    });

    it('generates S-curve LUT with contrast expansion (crushed darks, lifted highlights)', () => {
      const sCurvePoints = [
        { x: 0, y: 0 },
        { x: 64, y: 45 },
        { x: 192, y: 215 },
        { x: 255, y: 255 },
      ];
      const lut = buildCurveLUT(sCurvePoints);
      expect(lut.length).toBe(256);
      expect(lut[64]).toBeLessThan(64); // shadow pulled down
      expect(lut[192]).toBeGreaterThan(192); // highlight boosted up
      expect(lut[0]).toBe(0);
      expect(lut[255]).toBe(255);
    });

    it('matte blacks lift endpoints at x=0 without breaking monotonic bounds', () => {
      const mattePoints = [
        { x: 0, y: 35 },
        { x: 128, y: 128 },
        { x: 255, y: 255 },
      ];
      const lut = buildCurveLUT(mattePoints);
      expect(lut[0]).toBe(35); // true matte black floor
      expect(lut[255]).toBe(255);
      // All values clamped to 0..255
      for (let i = 0; i < 256; i++) {
        expect(lut[i]).toBeGreaterThanOrEqual(0);
        expect(lut[i]).toBeLessThanOrEqual(255);
      }
    });

    it('applies per-channel curves independently without contaminating other channels', () => {
      const curves: ToneCurves = {
        rgb: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
        red: [{ x: 0, y: 50 }, { x: 255, y: 255 }], // red channel lifted
        green: [{ x: 0, y: 0 }, { x: 255, y: 255 }], // green linear
        blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }], // blue linear
      };

      // Black pixel (0, 0, 0)
      const data = new Uint8ClampedArray([0, 0, 0, 255]);
      applyCurves(data, curves);

      expect(data[0]).toBe(50); // Red lifted
      expect(data[1]).toBe(0);  // Green untouched
      expect(data[2]).toBe(0);  // Blue untouched
      expect(data[3]).toBe(255);
    });
  });

  // 2. Professional Color Wheels
  describe('Color Wheels Radial & Luminance Engine', () => {
    it('produces identity transformation when color wheels are neutral (sat=0, lum=0)', () => {
      const neutralWheels: ColorWheels = {
        shadows: { hue: 0, saturation: 0, luminance: 0 },
        midtones: { hue: 0, saturation: 0, luminance: 0 },
        highlights: { hue: 0, saturation: 0, luminance: 0 },
      };

      const data = new Uint8ClampedArray([120, 130, 140, 255]);
      const original = new Uint8ClampedArray(data);
      applyColorWheels(data, neutralWheels);

      expect(data[0]).toBe(original[0]);
      expect(data[1]).toBe(original[1]);
      expect(data[2]).toBe(original[2]);
      expect(data[3]).toBe(255);
    });

    it('correctly maps polar angle to hue and radius to saturation', () => {
      const radius = 54;
      // 0 degrees (East) -> Pure Red
      const x1 = 54;
      const y1 = 0;
      const angle1 = (Math.atan2(y1, x1) * 180) / Math.PI;
      const dist1 = Math.sqrt(x1 * x1 + y1 * y1);
      const sat1 = Math.round((dist1 / radius) * 100);
      expect(angle1).toBe(0);
      expect(sat1).toBe(100);

      // 90 degrees (South) -> Yellow/Green
      const x2 = 0;
      const y2 = 54;
      const angle2 = (Math.atan2(y2, x2) * 180) / Math.PI;
      const dist2 = Math.sqrt(x2 * x2 + y2 * y2);
      const sat2 = Math.round((dist2 / radius) * 100);
      expect(angle2).toBe(90);
      expect(sat2).toBe(100);

      // 240 degrees (Blue) at half radius
      const angleRad = (240 * Math.PI) / 180;
      const x3 = 27 * Math.cos(angleRad);
      const y3 = 27 * Math.sin(angleRad);
      let angle3 = Math.round((Math.atan2(y3, x3) * 180) / Math.PI);
      if (angle3 < 0) angle3 += 360;
      const dist3 = Math.sqrt(x3 * x3 + y3 * y3);
      const sat3 = Math.round((dist3 / radius) * 100);
      expect(angle3).toBe(240);
      expect(sat3).toBe(50);
    });

    it('separates zones: shadow tint affects dark pixels far more than bright pixels', () => {
      const wheels: ColorWheels = {
        shadows: { hue: 200, saturation: 80, luminance: 0 }, // Strong cyan shadow tint
        midtones: { hue: 0, saturation: 0, luminance: 0 },
        highlights: { hue: 0, saturation: 0, luminance: 0 },
      };

      // Dark pixel (lum approx 30) vs Highlight pixel (lum approx 220)
      const shadowPixel = new Uint8ClampedArray([30, 30, 30, 255]);
      const highlightPixel = new Uint8ClampedArray([220, 220, 220, 255]);

      applyColorWheels(shadowPixel, wheels);
      applyColorWheels(highlightPixel, wheels);

      const shadowDelta = Math.abs(shadowPixel[0] - shadowPixel[2]); // R vs B difference
      const highlightDelta = Math.abs(highlightPixel[0] - highlightPixel[2]);

      expect(shadowDelta).toBeGreaterThan(highlightDelta * 4);
    });

    it('wheel luminance slider affects zone brightness', () => {
      const darkPixel = new Uint8ClampedArray([40, 40, 40, 255]);
      const wheels: ColorWheels = {
        shadows: { hue: 0, saturation: 0, luminance: 50 }, // Lift shadows luminance
        midtones: { hue: 0, saturation: 0, luminance: 0 },
        highlights: { hue: 0, saturation: 0, luminance: 0 },
      };

      applyColorWheels(darkPixel, wheels);
      expect(darkPixel[0]).toBeGreaterThan(40);
      expect(darkPixel[1]).toBeGreaterThan(40);
      expect(darkPixel[2]).toBeGreaterThan(40);
    });
  });

  // 3. Normalized Aspect Ratio Calculations
  describe('Crop Geometry & Aspect Ratio Normalization', () => {
    const calculateAspectCrop = (
      ratio: number | null,
      srcW: number,
      srcH: number
    ) => {
      if (!ratio) return { x: 0, y: 0, width: 1, height: 1 };
      const imgAspect = srcW / srcH;
      const normRatio = ratio / imgAspect;

      let w = 1;
      let h = 1;

      if (normRatio <= 1) {
        w = normRatio;
        h = 1;
      } else {
        w = 1;
        h = 1 / normRatio;
      }

      return {
        x: (1 - w) / 2,
        y: (1 - h) / 2,
        width: w,
        height: h,
      };
    };

    it('correctly calculates 1:1 crop centered on a 16:9 landscape image (1920x1080)', () => {
      const crop = calculateAspectCrop(1, 1920, 1080);
      expect(crop.height).toBe(1);
      // Normalized width should be 1 / (1920 / 1080) = 1080 / 1920 = 0.5625
      expect(crop.width).toBeCloseTo(0.5625, 4);
      expect(crop.x).toBeCloseTo((1 - 0.5625) / 2, 4);
      expect(crop.y).toBe(0);
      // Pixel dimensions check
      const pixelW = crop.width * 1920;
      const pixelH = crop.height * 1080;
      expect(pixelW).toBeCloseTo(pixelH, 1);
    });

    it('correctly calculates 1:1 crop centered on a 9:16 portrait image (1080x1920)', () => {
      const crop = calculateAspectCrop(1, 1080, 1920);
      expect(crop.width).toBe(1);
      // Normalized height should be 1080 / 1920 = 0.5625
      expect(crop.height).toBeCloseTo(0.5625, 4);
      expect(crop.y).toBeCloseTo((1 - 0.5625) / 2, 4);
      expect(crop.x).toBe(0);
      // Pixel dimensions check
      const pixelW = crop.width * 1080;
      const pixelH = crop.height * 1920;
      expect(pixelW).toBeCloseTo(pixelH, 1);
    });

    it('correctly calculates 4:5 social crop on a 1920x1080 landscape image', () => {
      const crop = calculateAspectCrop(4 / 5, 1920, 1080);
      const pixelW = crop.width * 1920;
      const pixelH = crop.height * 1080;
      expect(pixelW / pixelH).toBeCloseTo(4 / 5, 2);
    });

    it('free crop defaults to entire image (0, 0, 1, 1)', () => {
      const crop = calculateAspectCrop(null, 1920, 1080);
      expect(crop).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    });
  });

  // 4. Straightening & Rotation Auto-Crop Scaling
  describe('Rotation Auto-Crop Wedge Elimination', () => {
    const calcAutoCropScale = (angleDeg: number, w: number, h: number) => {
      const fineRad = (Math.abs(angleDeg) * Math.PI) / 180;
      const aspect = w / h;
      return Math.cos(fineRad) + Math.sin(fineRad) * Math.max(aspect, 1 / aspect);
    };

    it('returns scale = 1.0 for 0 degree rotation', () => {
      const scale = calcAutoCropScale(0, 1920, 1080);
      expect(scale).toBe(1.0);
    });

    it('calculates sufficient overdraw scale S > 1.0 for fine angles to eliminate corner clipping', () => {
      const scale5 = calcAutoCropScale(5, 1920, 1080);
      expect(scale5).toBeGreaterThan(1.0);
      expect(scale5).toBeCloseTo(1.15, 1);

      const scale15 = calcAutoCropScale(15, 1920, 1080);
      expect(scale15).toBeGreaterThan(scale5);
      expect(scale15).toBeCloseTo(1.42, 1);

      const scale45 = calcAutoCropScale(45, 1920, 1080);
      expect(scale45).toBeGreaterThan(scale15);
    });

    it('is symmetric for positive and negative rotation angles', () => {
      const pos = calcAutoCropScale(12.5, 1920, 1080);
      const neg = calcAutoCropScale(-12.5, 1920, 1080);
      expect(pos).toBe(neg);
    });
  });

  // 5. History Lifecycle Simulation for Continuous Gestures
  describe('Gesture-to-History Single Commit Lifecycle', () => {
    it('groups continuous slider/curve/handle movement into a single history snapshot', () => {
      let isInteracting = false;
      let preSnapshot: number | null = null;
      const historyPast: number[] = [];

      // Gesture start
      const onInteractionStart = (initialValue: number) => {
        if (!isInteracting) {
          preSnapshot = initialValue;
          isInteracting = true;
        }
      };

      // 100 continuous updates during mouse drag
      let currentValue = 0;
      onInteractionStart(currentValue);

      for (let i = 1; i <= 100; i++) {
        currentValue = i;
      }

      // Gesture end
      const onInteractionEnd = () => {
        if (isInteracting && preSnapshot !== null) {
          if (preSnapshot !== currentValue) {
            historyPast.push(preSnapshot);
          }
          isInteracting = false;
          preSnapshot = null;
        }
      };

      onInteractionEnd();

      // Verify that after 100 continuous updates, only 1 snapshot was added to undo stack
      expect(historyPast.length).toBe(1);
      expect(historyPast[0]).toBe(0);
      expect(currentValue).toBe(100);
    });
  });
});
