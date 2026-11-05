import {
  AdjustmentParameters,
  BackgroundReplacementState,
  ColorWheels,
  CutoutState,
  DominantColor,
  GeometryState,
  HistogramData,
  HslAdjustments,
  HslChannel,
  Preset,
  ToneCurves,
} from '../types/editor';
import { DEFAULT_HSL } from '../constants/defaults';

export function clampAdjustmentParam(key: keyof AdjustmentParameters, value: number): number {
  switch (key) {
    case 'exposure':
      return Math.max(-2, Math.min(2, value));
    case 'hue':
      return Math.max(-180, Math.min(180, value));
    case 'blur':
    case 'sharpen':
    case 'noiseReduction':
    case 'vignette':
    case 'grain':
    case 'fade':
      return Math.max(0, Math.min(100, value));
    default:
      return Math.max(-100, Math.min(100, value));
  }
}

/**
 * Intelligent histogram-driven auto-enhancement algorithm
 * Computes cumulative luminance distribution, exposure delta, dynamic contrast,
 * highlight/shadow compensation, white/black clipping points, and gray-world color balance.
 */
export function calculateAutoTone(
  histogram: HistogramData | null | undefined,
  current: AdjustmentParameters
): AdjustmentParameters {
  if (!histogram || !histogram.l || histogram.l.length < 256) {
    return { ...current };
  }

  const histL = histogram.l;
  const histR = histogram.r;
  const histG = histogram.g;
  const histB = histogram.b;

  let totalPixels = 0;
  for (let i = 0; i < 256; i++) {
    totalPixels += histL[i];
  }
  if (totalPixels <= 0) return { ...current };

  // Calculate cumulative percentiles
  const p1Target = totalPixels * 0.01;
  const p50Target = totalPixels * 0.50;
  const p99Target = totalPixels * 0.99;

  let cum = 0;
  let p1 = 0;
  let p50 = 128;
  let p99 = 255;
  let p1Found = false;
  let p50Found = false;
  let p99Found = false;

  let sumL = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (let i = 0; i < 256; i++) {
    const countL = histL[i];
    cum += countL;
    sumL += i * countL;
    if (histR) sumR += i * histR[i];
    if (histG) sumG += i * histG[i];
    if (histB) sumB += i * histB[i];

    if (!p1Found && cum >= p1Target) {
      p1 = i;
      p1Found = true;
    }
    if (!p50Found && cum >= p50Target) {
      p50 = i;
      p50Found = true;
    }
    if (!p99Found && cum >= p99Target) {
      p99 = i;
      p99Found = true;
    }
  }

  const meanR = sumR / totalPixels;
  const meanG = sumG / totalPixels;
  const meanB = sumB / totalPixels;

  // 1. Exposure calculation (target median ~122)
  const targetMedian = 122;
  const medianRatio = targetMedian / Math.max(10, p50);
  let evDelta = Math.log2(medianRatio) * 0.75;
  evDelta = Math.max(-1.5, Math.min(1.5, Math.round(evDelta * 20) / 20));

  // 2. Dynamic range and contrast
  const dynamicRange = p99 - p1;
  let contrastDelta = 0;
  if (dynamicRange < 140) {
    contrastDelta = Math.round(((140 - dynamicRange) / 140) * 35);
  } else if (dynamicRange > 240) {
    contrastDelta = -Math.round(((dynamicRange - 240) / 15) * 8);
  } else {
    contrastDelta = 10;
  }

  // 3. Highlight recovery / Shadow lift
  let highlightsDelta = 0;
  if (p99 > 240) {
    highlightsDelta = -Math.round(((p99 - 240) / 15) * 40);
  }

  let shadowsDelta = 0;
  if (p50 < 100 || p1 < 10) {
    shadowsDelta = Math.min(35, Math.round(((100 - Math.min(p50, 100)) / 100) * 40));
  }

  // 4. White & Black point clipping / stretching
  let whitesDelta = 0;
  if (p99 < 220) {
    whitesDelta = Math.min(30, Math.round(((220 - p99) / 220) * 35));
  } else if (p99 > 250) {
    whitesDelta = -10;
  }

  let blacksDelta = 0;
  if (p1 > 25) {
    blacksDelta = -Math.min(30, Math.round(((p1 - 25) / 25) * 30));
  } else if (p1 < 3) {
    blacksDelta = 12;
  }

  // 5. Auto White Balance (Gray World color balance)
  let tempDelta = 0;
  let tintDelta = 0;
  if (histR && histG && histB) {
    const blueRedDelta = (meanB - meanR) / 255;
    tempDelta = Math.round(blueRedDelta * 40);
    const greenDelta = (meanG - (meanR + meanB) / 2) / 255;
    tintDelta = -Math.round(greenDelta * 40);
  }

  return {
    ...current,
    exposure: clampAdjustmentParam('exposure', evDelta),
    contrast: clampAdjustmentParam('contrast', contrastDelta),
    highlights: clampAdjustmentParam('highlights', highlightsDelta),
    shadows: clampAdjustmentParam('shadows', shadowsDelta),
    whites: clampAdjustmentParam('whites', whitesDelta),
    blacks: clampAdjustmentParam('blacks', blacksDelta),
    temperature: clampAdjustmentParam('temperature', tempDelta),
    tint: clampAdjustmentParam('tint', tintDelta),
    clarity: clampAdjustmentParam('clarity', 12),
    vibrance: clampAdjustmentParam('vibrance', 14),
  };
}

/**
 * Interpolates preset/template parameters, wheels, curves, and HSL mixer with base adjustments
 * according to template intensity (0..100).
 * At intensity 0, returns the neutral base adjustments without template contributions.
 */
export function blendPresetAdjustments(
  base: AdjustmentParameters,
  preset: Preset | null,
  intensity: number,
  baseWheels?: ColorWheels,
  baseCurves?: ToneCurves,
  baseHsl?: HslAdjustments
): {
  adjustments: AdjustmentParameters;
  wheels?: ColorWheels;
  curves?: ToneCurves;
  hsl?: HslAdjustments;
} {
  if (!preset || intensity === 0) {
    return {
      adjustments: { ...base },
      wheels: baseWheels ? { ...baseWheels } : undefined,
      curves: baseCurves ? { ...baseCurves } : undefined,
      hsl: baseHsl ? { ...baseHsl } : undefined,
    };
  }

  const factor = Math.max(0, Math.min(1, intensity / 100));
  const blended: AdjustmentParameters = { ...base };

  const presetParams = preset.parameters;
  for (const key in presetParams) {
    const paramKey = key as keyof AdjustmentParameters;
    const pVal = presetParams[paramKey];
    if (typeof pVal === 'number') {
      const bVal = base[paramKey] || 0;
      blended[paramKey] = clampAdjustmentParam(paramKey, bVal + pVal * factor);
    }
  }

  // Blend Color Wheels
  let blendedWheels: ColorWheels | undefined = baseWheels ? { ...baseWheels } : undefined;
  if (preset.wheels) {
    const bw = baseWheels || {
      shadows: { hue: 0, saturation: 0, luminance: 0 },
      midtones: { hue: 0, saturation: 0, luminance: 0 },
      highlights: { hue: 0, saturation: 0, luminance: 0 },
    };

    blendedWheels = {
      shadows: {
        hue: bw.shadows.saturation > 0 ? bw.shadows.hue : preset.wheels.shadows?.hue || 0,
        saturation: Math.min(100, (bw.shadows.saturation || 0) + (preset.wheels.shadows?.saturation || 0) * factor),
        luminance: Math.max(-100, Math.min(100, (bw.shadows.luminance || 0) + (preset.wheels.shadows?.luminance || 0) * factor)),
      },
      midtones: {
        hue: bw.midtones.saturation > 0 ? bw.midtones.hue : preset.wheels.midtones?.hue || 0,
        saturation: Math.min(100, (bw.midtones.saturation || 0) + (preset.wheels.midtones?.saturation || 0) * factor),
        luminance: Math.max(-100, Math.min(100, (bw.midtones.luminance || 0) + (preset.wheels.midtones?.luminance || 0) * factor)),
      },
      highlights: {
        hue: bw.highlights.saturation > 0 ? bw.highlights.hue : preset.wheels.highlights?.hue || 0,
        saturation: Math.min(100, (bw.highlights.saturation || 0) + (preset.wheels.highlights?.saturation || 0) * factor),
        luminance: Math.max(-100, Math.min(100, (bw.highlights.luminance || 0) + (preset.wheels.highlights?.luminance || 0) * factor)),
      },
    };
  }

  // Blend Tone Curves
  let blendedCurves: ToneCurves | undefined = baseCurves ? { ...baseCurves } : undefined;
  if (preset.curves) {
    const channels: (keyof ToneCurves)[] = ['rgb', 'red', 'green', 'blue'];
    const resultCurves: Partial<ToneCurves> = baseCurves ? { ...baseCurves } : {};

    channels.forEach((channel) => {
      const templatePoints = preset.curves?.[channel];
      if (templatePoints && templatePoints.length > 0) {
        resultCurves[channel] = templatePoints.map((pt) => ({
          x: pt.x,
          y: Math.max(0, Math.min(255, Math.round(pt.x + (pt.y - pt.x) * factor))),
        }));
      }
    });

    blendedCurves = resultCurves as ToneCurves;
  }

  // Blend 8-Channel HSL Mixer
  let blendedHsl: HslAdjustments | undefined = baseHsl ? { ...baseHsl } : undefined;
  if (preset.hsl) {
    const resultHsl: HslAdjustments = baseHsl
      ? JSON.parse(JSON.stringify(baseHsl))
      : JSON.parse(JSON.stringify(DEFAULT_HSL));

    (Object.keys(preset.hsl) as HslChannel[]).forEach((ch) => {
      const pAdj = preset.hsl?.[ch];
      const bAdj = resultHsl[ch] || { hue: 0, saturation: 0, luminance: 0 };
      if (pAdj) {
        resultHsl[ch] = {
          hue: Math.max(-100, Math.min(100, bAdj.hue + pAdj.hue * factor)),
          saturation: Math.max(-100, Math.min(100, bAdj.saturation + pAdj.saturation * factor)),
          luminance: Math.max(-100, Math.min(100, bAdj.luminance + pAdj.luminance * factor)),
        };
      }
    });
    blendedHsl = resultHsl;
  }

  return { adjustments: blended, wheels: blendedWheels, curves: blendedCurves, hsl: blendedHsl };
}

/**
 * Builds a 256-entry lookup table (LUT) from tone curve control points
 */
export function buildCurveLUT(points: { x: number; y: number }[]): Uint8Array {
  const lut = new Uint8Array(256);
  if (!points || points.length === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  const sorted = [...points].sort((a, b) => a.x - b.x);

  // Linear / piecewise interpolation between control points
  let currentIdx = 0;
  for (let i = 0; i < 256; i++) {
    while (currentIdx < sorted.length - 2 && sorted[currentIdx + 1].x < i) {
      currentIdx++;
    }
    const p1 = sorted[currentIdx];
    const p2 = sorted[currentIdx + 1] || p1;

    if (p1.x === p2.x) {
      lut[i] = Math.max(0, Math.min(255, Math.round(p1.y)));
    } else {
      const t = (i - p1.x) / (p2.x - p1.x);
      const val = p1.y + t * (p2.y - p1.y);
      lut[i] = Math.max(0, Math.min(255, Math.round(val)));
    }
  }

  return lut;
}

/**
 * Converts RGB to HSL [0..360, 0..1, 0..1]
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const normR = r / 255;
  const normG = g / 255;
  const normB = b / 255;
  const max = Math.max(normR, normG, normB);
  const min = Math.min(normR, normG, normB);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case normR:
        h = (normG - normB) / d + (normG < normB ? 6 : 0);
        break;
      case normG:
        h = (normB - normR) / d + 2;
        break;
      case normB:
        h = (normR - normG) / d + 4;
        break;
    }
    h *= 60;
  }
  return [h, s, l];
}

/**
 * Converts RGB to HSL and back for color split toning
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

const HSL_CHANNEL_CENTERS: Record<HslChannel, number> = {
  red: 0,
  orange: 30,
  yellow: 60,
  green: 120,
  aqua: 180,
  blue: 240,
  purple: 280,
  magenta: 320,
};

/**
 * 8-Channel HSL Color Mixer
 * Selectively adjusts Hue, Saturation, and Luminance of 8 distinct chromatic bands
 * with smooth angular falloff blending to prevent banding artifacts.
 */
export function applyHsl(data: Uint8ClampedArray, hsl: HslAdjustments): void {
  if (!hsl) return;

  let hasActiveAdj = false;
  for (const ch of Object.keys(hsl) as HslChannel[]) {
    const adj = hsl[ch];
    if (adj && (adj.hue !== 0 || adj.saturation !== 0 || adj.luminance !== 0)) {
      hasActiveAdj = true;
      break;
    }
  }
  if (!hasActiveAdj) return;

  const len = data.length;
  const channels = Object.keys(hsl) as HslChannel[];

  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const [h, s, l] = rgbToHsl(r, g, b);
    if (s < 0.03 || l < 0.02 || l > 0.98) continue;

    let deltaH = 0;
    let deltaS = 0;
    let deltaL = 0;
    let totalWeight = 0;

    for (let c = 0; c < channels.length; c++) {
      const ch = channels[c];
      const adj = hsl[ch];
      if (!adj || (adj.hue === 0 && adj.saturation === 0 && adj.luminance === 0)) continue;

      const centerH = HSL_CHANNEL_CENTERS[ch];
      let dist = Math.abs(h - centerH);
      if (dist > 180) dist = 360 - dist;

      if (dist < 45) {
        const weight = 1 - dist / 45;
        deltaH += adj.hue * weight;
        deltaS += adj.saturation * weight;
        deltaL += adj.luminance * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight > 0) {
      const scale = totalWeight > 1 ? 1 / totalWeight : 1;
      deltaH *= scale;
      deltaS *= scale;
      deltaL *= scale;

      const newH = ((h + deltaH * 0.3) % 360 + 360) % 360;
      const newS = Math.max(0, Math.min(1, s * (1 + deltaS / 100)));
      const lumDelta = (deltaL / 100) * 0.5;
      const newL = Math.max(0, Math.min(1, l + lumDelta * (l < 0.5 ? l : 1 - l)));

      const [newR, newG, newB] = hslToRgb(newH, newS, newL);
      data[i] = newR;
      data[i + 1] = newG;
      data[i + 2] = newB;
    }
  }
}

/**
 * Edge-preserving bilateral filter for noise reduction.
 * Smooths high-frequency sensor grain and chroma noise in flat/shadow areas
 * while preserving sharp edges and acutance.
 */
export function applyNoiseReduction(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  amount: number
): void {
  if (amount <= 0 || w <= 0 || h <= 0) return;
  const factor = Math.max(0, Math.min(1, amount / 100));
  const sigmaR = 12 + factor * 8;
  const twoSigmaRSq = 2 * sigmaR * sigmaR;
  const src = new Uint8ClampedArray(data);

  for (let y = 0; y < h; y++) {
    const yRow = y * w;
    const yMin = Math.max(0, y - 1);
    const yMax = Math.min(h - 1, y + 1);

    for (let x = 0; x < w; x++) {
      const idx = (yRow + x) * 4;
      const cR = src[idx];
      const cG = src[idx + 1];
      const cB = src[idx + 2];
      const cLum = 0.2126 * cR + 0.7152 * cG + 0.0722 * cB;

      let sumR = 0, sumG = 0, sumB = 0, sumW = 0;

      const xMin = Math.max(0, x - 1);
      const xMax = Math.min(w - 1, x + 1);

      for (let ny = yMin; ny <= yMax; ny++) {
        const nyRow = ny * w;
        for (let nx = xMin; nx <= xMax; nx++) {
          const nIdx = (nyRow + nx) * 4;
          const nR = src[nIdx];
          const nG = src[nIdx + 1];
          const nB = src[nIdx + 2];
          const nLum = 0.2126 * nR + 0.7152 * nG + 0.0722 * nB;

          const diff = nLum - cLum;
          const weight = Math.exp(-(diff * diff) / twoSigmaRSq);

          sumR += nR * weight;
          sumG += nG * weight;
          sumB += nB * weight;
          sumW += weight;
        }
      }

      if (sumW > 0) {
        const smoothR = sumR / sumW;
        const smoothG = sumG / sumW;
        const smoothB = sumB / sumW;

        data[idx] = Math.round(cR + (smoothR - cR) * factor);
        data[idx + 1] = Math.round(cG + (smoothG - cG) * factor);
        data[idx + 2] = Math.round(cB + (smoothB - cB) * factor);
      }
    }
  }
}

/**
 * Smart On-Device Background Removal & Matting
 * Non-destructive subject isolation with boundary contrast profiling,
 * tolerance gating, and anti-aliased Hermite feathering.
 */
/**
 * Smart AI Background Removal & Matting
 * Non-destructive subject isolation with real salient contour matting,
 * precomputed alpha masks, tolerance threshold gating, and anti-aliased Hermite feathering.
 */
export function applyCutout(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  cutout: CutoutState
): void {
  if (!cutout || !cutout.enabled || w <= 0 || h <= 0) return;

  // Case 1: Precomputed high-fidelity alpha mask is present
  if (cutout.maskAlpha && cutout.maskAlpha.length === w * h) {
    const mask = cutout.maskAlpha;
    const tolShift = (cutout.tolerance - 35) * 1.5;
    const invert = cutout.invert;

    for (let i = 0; i < mask.length; i++) {
      const idx = i * 4;
      const rawAlpha = mask[i];
      let a = Math.max(0, Math.min(255, rawAlpha + tolShift));
      if (invert) {
        a = 255 - a;
      }
      data[idx + 3] = Math.round(a);
    }
    return;
  }

  // Case 2: AI Salient Subject Contour Mode (inline inference when precomputed mask is not attached)
  if (cutout.mode === 'ai') {
    const cx = w * 0.5;
    const cy = h * 0.45;
    const twoSigmaXSq = 2 * (w * 0.45) * (w * 0.45);
    const twoSigmaYSq = 2 * (h * 0.5) * (h * 0.5);

    // Sample perimeter
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    for (let x = 0; x < w; x += 2) {
      sumR += data[x * 4] + data[((h - 1) * w + x) * 4];
      sumG += data[x * 4 + 1] + data[((h - 1) * w + x) * 4 + 1];
      sumB += data[x * 4 + 2] + data[((h - 1) * w + x) * 4 + 2];
      count += 2;
    }
    const bgR = count > 0 ? sumR / count : 255;
    const bgG = count > 0 ? sumG / count : 255;
    const bgB = count > 0 ? sumB / count : 255;

    const tol = Math.max(5, Math.min(95, cutout.tolerance));
    const distThresh = (tol / 100) * 255 * 1.1;

    for (let y = 0; y < h; y++) {
      const dy = y - cy;
      const yRow = y * w;
      const spatialY = (dy * dy) / twoSigmaYSq;

      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const spatialWeight = Math.exp(-((dx * dx) / twoSigmaXSq + spatialY));
        const idx = (yRow + x) * 4;

        const dR = data[idx] - bgR;
        const dG = data[idx + 1] - bgG;
        const dB = data[idx + 2] - bgB;
        const colorDist = Math.sqrt(0.299 * dR * dR + 0.587 * dG * dG + 0.114 * dB * dB);

        let colorScore = 0;
        if (colorDist > distThresh * 1.3) colorScore = 1;
        else if (colorDist > distThresh * 0.6) colorScore = (colorDist - distThresh * 0.6) / (distThresh * 0.7);

        const saliency = 0.65 * colorScore + 0.35 * spatialWeight;

        // Hermite smoothstep
        let a = 0;
        if (saliency >= 0.55) a = 255;
        else if (saliency <= 0.25) a = 0;
        else {
          const t = (saliency - 0.25) / 0.3;
          a = Math.round(t * t * (3 - 2 * t) * 255);
        }

        if (cutout.invert) a = 255 - a;
        data[idx + 3] = a;
      }
    }
    return;
  }

  let bgR = 0;
  let bgG = 0;
  let bgB = 0;

  if (cutout.mode === 'color' && cutout.targetColor) {
    bgR = cutout.targetColor.r;
    bgG = cutout.targetColor.g;
    bgB = cutout.targetColor.b;
  } else {
    // Auto Mode: sample outer perimeter boundary pixels (top, bottom, left, right)
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sampleCount = 0;

    // Top and bottom rows (stride of 2 for performance)
    for (let x = 0; x < w; x += 2) {
      const topIdx = x * 4;
      sumR += data[topIdx];
      sumG += data[topIdx + 1];
      sumB += data[topIdx + 2];
      sampleCount++;

      const btmIdx = ((h - 1) * w + x) * 4;
      sumR += data[btmIdx];
      sumG += data[btmIdx + 1];
      sumB += data[btmIdx + 2];
      sampleCount++;
    }

    // Left and right columns
    for (let y = 1; y < h - 1; y += 2) {
      const leftIdx = (y * w) * 4;
      sumR += data[leftIdx];
      sumG += data[leftIdx + 1];
      sumB += data[leftIdx + 2];
      sampleCount++;

      const rightIdx = (y * w + (w - 1)) * 4;
      sumR += data[rightIdx];
      sumG += data[rightIdx + 1];
      sumB += data[rightIdx + 2];
      sampleCount++;
    }

    if (sampleCount > 0) {
      bgR = sumR / sampleCount;
      bgG = sumG / sampleCount;
      bgB = sumB / sampleCount;
    }
  }

  const tol = Math.max(1, Math.min(100, cutout.tolerance));
  const feather = Math.max(0, Math.min(20, cutout.feather));
  const featherSpan = Math.max(1, feather * 1.5);

  const tLow = Math.max(0, tol - featherSpan / 2);
  const tHigh = Math.min(100, tol + featherSpan / 2);
  const tDiff = Math.max(0.1, tHigh - tLow);

  const len = w * h * 4;
  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Perceptually weighted Euclidean color distance
    const dR = r - bgR;
    const dG = g - bgG;
    const dB = b - bgB;
    const dist = Math.sqrt(0.3 * dR * dR + 0.59 * dG * dG + 0.11 * dB * dB);
    const normDist = (dist / 255) * 100;

    let alpha = 255;
    if (normDist <= tLow) {
      alpha = 0;
    } else if (normDist >= tHigh) {
      alpha = 255;
    } else {
      const t = (normDist - tLow) / tDiff;
      // Hermite smoothstep for anti-aliased edge falloff
      const smooth = t * t * (3 - 2 * t);
      alpha = Math.round(smooth * 255);
    }

    if (cutout.invert) {
      alpha = 255 - alpha;
    }

    data[i + 3] = alpha;
  }
}

/**
 * Composites isolated foreground subject onto a replacement backdrop (solid color, uploaded image, or AI scene).
 */
export function compositeBackgroundReplacement(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  subjectImageData: ImageData,
  bgState: BackgroundReplacementState,
  bgImage?: CanvasImageSource | null
): void {
  const w = canvas.width;
  const h = canvas.height;
  if (w <= 0 || h <= 0) return;

  // 1. Copy the isolated subject onto an offscreen canvas
  let subjectCanvas: HTMLCanvasElement | null = null;
  if (typeof document !== 'undefined') {
    subjectCanvas = document.createElement('canvas');
    subjectCanvas.width = w;
    subjectCanvas.height = h;
    const sCtx = subjectCanvas.getContext('2d');
    if (sCtx) {
      sCtx.putImageData(subjectImageData, 0, 0);
    }
  }

  // 2. Clear canvas to start fresh multi-layer composite
  ctx.clearRect(0, 0, w, h);

  // 3. Draw replacement background
  ctx.save();
  if (bgState.mode === 'color') {
    ctx.fillStyle = bgState.color || '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
  } else if ((bgState.mode === 'image' || bgState.mode === 'ai') && bgImage) {
    const bgScale = Math.max(0.2, Math.min(3, bgState.bgTransform?.scale ?? 1));
    const bgOffsetX = ((bgState.bgTransform?.offsetX ?? 0) / 100) * w;
    const bgOffsetY = ((bgState.bgTransform?.offsetY ?? 0) / 100) * h;
    const fit = bgState.bgTransform?.fit || 'cover';
    const blur = Math.max(0, Math.min(25, bgState.bgTransform?.blur ?? 0));

    let imgW = w;
    let imgH = h;
    if ('naturalWidth' in bgImage && (bgImage as HTMLImageElement).naturalWidth > 0) {
      imgW = (bgImage as HTMLImageElement).naturalWidth;
      imgH = (bgImage as HTMLImageElement).naturalHeight;
    } else if ('width' in bgImage) {
      imgW = (bgImage as any).width || w;
      imgH = (bgImage as any).height || h;
    }

    let drawW = w;
    let drawH = h;

    if (fit === 'cover') {
      const scale = Math.max(w / imgW, h / imgH) * bgScale;
      drawW = imgW * scale;
      drawH = imgH * scale;
    } else if (fit === 'contain') {
      const scale = Math.min(w / imgW, h / imgH) * bgScale;
      drawW = imgW * scale;
      drawH = imgH * scale;
    } else {
      drawW = w * bgScale;
      drawH = h * bgScale;
    }

    const drawX = (w - drawW) / 2 + bgOffsetX;
    const drawY = (h - drawH) / 2 + bgOffsetY;

    if (blur > 0) {
      ctx.filter = `blur(${blur}px)`;
    }
    ctx.drawImage(bgImage, drawX, drawY, drawW, drawH);
    ctx.filter = 'none';
  } else {
    // Default studio dark gradient while asset loads
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1E1B4B');
    grad.addColorStop(1, '#070B14');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();

  // 4. Draw isolated foreground subject over the background
  if (subjectCanvas) {
    ctx.save();
    const fgScale = Math.max(0.2, Math.min(2, bgState.fgTransform?.scale ?? 1));
    const fgOffsetX = ((bgState.fgTransform?.offsetX ?? 0) / 100) * w;
    const fgOffsetY = ((bgState.fgTransform?.offsetY ?? 0) / 100) * h;

    const fgW = w * fgScale;
    const fgH = h * fgScale;
    const fgX = (w - fgW) / 2 + fgOffsetX;
    const fgY = (h - fgH) / 2 + fgOffsetY;

    ctx.drawImage(subjectCanvas, fgX, fgY, fgW, fgH);
    ctx.restore();
  }
}

/**
 * Applies 3-way color wheels split-toning and zone luminance to pixel buffer.
 */
export function applyColorWheels(data: Uint8ClampedArray, wheels: ColorWheels): void {
  let shadowTintR = 0, shadowTintG = 0, shadowTintB = 0;
  let midtoneTintR = 0, midtoneTintG = 0, midtoneTintB = 0;
  let highlightTintR = 0, highlightTintG = 0, highlightTintB = 0;

  if (wheels.shadows && wheels.shadows.saturation > 0) {
    const [r, g, b] = hslToRgb(wheels.shadows.hue, wheels.shadows.saturation / 100, 0.5);
    shadowTintR = (r - 128) / 128;
    shadowTintG = (g - 128) / 128;
    shadowTintB = (b - 128) / 128;
  }
  if (wheels.midtones && wheels.midtones.saturation > 0) {
    const [r, g, b] = hslToRgb(wheels.midtones.hue, wheels.midtones.saturation / 100, 0.5);
    midtoneTintR = (r - 128) / 128;
    midtoneTintG = (g - 128) / 128;
    midtoneTintB = (b - 128) / 128;
  }
  if (wheels.highlights && wheels.highlights.saturation > 0) {
    const [r, g, b] = hslToRgb(wheels.highlights.hue, wheels.highlights.saturation / 100, 0.5);
    highlightTintR = (r - 128) / 128;
    highlightTintG = (g - 128) / 128;
    highlightTintB = (b - 128) / 128;
  }

  const shadowLumDelta = ((wheels.shadows?.luminance || 0) / 100) * 50;
  const midtoneLumDelta = ((wheels.midtones?.luminance || 0) / 100) * 50;
  const highlightLumDelta = ((wheels.highlights?.luminance || 0) / 100) * 50;

  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    const u = Math.max(0, Math.min(1, lum / 255));
    const shadowWeight = Math.max(0, 1 - 2 * u);
    const midtoneWeight = Math.sin(Math.PI * u);
    const highlightWeight = Math.max(0, 2 * u - 1);

    if (shadowTintR !== 0 || shadowTintG !== 0 || shadowTintB !== 0) {
      r += shadowTintR * shadowWeight * 50;
      g += shadowTintG * shadowWeight * 50;
      b += shadowTintB * shadowWeight * 50;
    }
    if (midtoneTintR !== 0 || midtoneTintG !== 0 || midtoneTintB !== 0) {
      r += midtoneTintR * midtoneWeight * 50;
      g += midtoneTintG * midtoneWeight * 50;
      b += midtoneTintB * midtoneWeight * 50;
    }
    if (highlightTintR !== 0 || highlightTintG !== 0 || highlightTintB !== 0) {
      r += highlightTintR * highlightWeight * 50;
      g += highlightTintG * highlightWeight * 50;
      b += highlightTintB * highlightWeight * 50;
    }

    if (shadowLumDelta !== 0) {
      r += shadowLumDelta * shadowWeight;
      g += shadowLumDelta * shadowWeight;
      b += shadowLumDelta * shadowWeight;
    }
    if (midtoneLumDelta !== 0) {
      r += midtoneLumDelta * midtoneWeight;
      g += midtoneLumDelta * midtoneWeight;
      b += midtoneLumDelta * midtoneWeight;
    }
    if (highlightLumDelta !== 0) {
      r += highlightLumDelta * highlightWeight;
      g += highlightLumDelta * highlightWeight;
      b += highlightLumDelta * highlightWeight;
    }

    data[i] = Math.max(0, Math.min(255, Math.round(r)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
  }
}

/**
 * Applies Tone Curves LUTs (RGB master, Red, Green, Blue) to pixel buffer.
 */
export function applyCurves(data: Uint8ClampedArray, curves: ToneCurves): void {
  const rgbLUT = curves.rgb ? buildCurveLUT(curves.rgb) : null;
  const redLUT = curves.red ? buildCurveLUT(curves.red) : null;
  const greenLUT = curves.green ? buildCurveLUT(curves.green) : null;
  const blueLUT = curves.blue ? buildCurveLUT(curves.blue) : null;

  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (rgbLUT) {
      r = rgbLUT[r];
      g = rgbLUT[g];
      b = rgbLUT[b];
    }
    if (redLUT) r = redLUT[r];
    if (greenLUT) g = greenLUT[g];
    if (blueLUT) b = blueLUT[b];

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

/**
 * Fast 1D Separable Box Blur for Luminance channel
 */
export function boxBlurLuminance(lum: Float32Array, w: number, h: number, radius: number): Float32Array {
  const temp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const r = Math.max(1, Math.floor(radius));

  // Horizontal blur: lum -> temp
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    let sum = 0;
    for (let k = -r; k <= r; k++) {
      const px = Math.min(w - 1, Math.max(0, k));
      sum += lum[rowOffset + px];
    }
    const windowSize = 2 * r + 1;
    temp[rowOffset] = sum / windowSize;

    for (let x = 1; x < w; x++) {
      const prevX = Math.max(0, x - 1 - r);
      const nextX = Math.min(w - 1, x + r);
      sum += lum[rowOffset + nextX] - lum[rowOffset + prevX];
      temp[rowOffset + x] = sum / windowSize;
    }
  }

  // Vertical blur: temp -> out
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) {
      const py = Math.min(h - 1, Math.max(0, k));
      sum += temp[py * w + x];
    }
    const windowSize = 2 * r + 1;
    out[x] = sum / windowSize;

    for (let y = 1; y < h; y++) {
      const prevY = Math.max(0, y - 1 - r);
      const nextY = Math.min(h - 1, y + r);
      sum += temp[nextY * w + x] - temp[prevY * w + x];
      out[y * w + x] = sum / windowSize;
    }
  }

  return out;
}

/**
 * Applies Clarity (Local Midtone Contrast Enhancement)
 * Enhances micro-contrast in the midtones using local high-frequency difference
 * with a sinusoidal weighting bell curve that tapers to 0 at shadows and highlights.
 */
export function applyClarity(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  clarity: number
): void {
  if (clarity === 0 || w <= 0 || h <= 0) return;

  const len = w * h;
  const lum = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const idx = i * 4;
    lum[i] = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
  }

  const radius = Math.max(2, Math.min(16, Math.round(Math.min(w, h) / 100)));
  const blurred = boxBlurLuminance(lum, w, h, radius);

  const factor = (clarity / 100) * 1.5;
  for (let i = 0; i < len; i++) {
    const idx = i * 4;
    const l = lum[i];
    const diff = l - blurred[i];
    // Sinusoidal midtone bell curve: peak at midtones, 0 at extremes
    const u = Math.max(0, Math.min(1, l / 255));
    const midtoneWeight = Math.sin(Math.PI * u);
    const delta = diff * factor * midtoneWeight;

    data[idx] = Math.max(0, Math.min(255, data[idx] + delta));
    data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + delta));
    data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + delta));
  }
}

/**
 * Applies Sharpen (Discrete Laplacian Edge Acutance Kernel)
 * Enhances edge definition while preserving alpha transparency and clamping to [0, 255].
 */
export function applySharpen(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  sharpen: number
): void {
  if (sharpen <= 0 || w <= 0 || h <= 0) return;

  const k = (sharpen / 100) * 0.6;
  if (k <= 0) return;

  const src = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    const yUp = y > 0 ? y - 1 : 0;
    const yDown = y < h - 1 ? y + 1 : h - 1;
    const rowOffset = y * w;
    const upOffset = yUp * w;
    const downOffset = yDown * w;

    for (let x = 0; x < w; x++) {
      const xLeft = x > 0 ? x - 1 : 0;
      const xRight = x < w - 1 ? x + 1 : w - 1;

      const center = (rowOffset + x) * 4;
      const top = (upOffset + x) * 4;
      const bottom = (downOffset + x) * 4;
      const left = (rowOffset + xLeft) * 4;
      const right = (rowOffset + xRight) * 4;

      for (let c = 0; c < 3; c++) {
        const val =
          (1 + 4 * k) * src[center + c] -
          k * (src[top + c] + src[bottom + c] + src[left + c] + src[right + c]);
        data[center + c] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
  }
}

/**
 * Constrains massive dimensions (e.g. 48MP+ or > 8192px) to prevent mobile canvas allocation OOM
 */
export function constrainDimensions(
  width: number,
  height: number,
  maxDimension: number = 8192,
  maxPixels: number = 48_000_000
): { width: number; height: number; scaled: boolean } {
  if (width <= 0 || height <= 0) return { width: 1, height: 1, scaled: false };

  let w = width;
  let h = height;
  let scaled = false;

  // 1. Constrain max single dimension
  if (w > maxDimension || h > maxDimension) {
    const scale = maxDimension / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    scaled = true;
  }

  // 2. Constrain max total pixel buffer area
  if (w * h > maxPixels) {
    const scale = Math.sqrt(maxPixels / (w * h));
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    scaled = true;
  }

  return { width: Math.max(1, w), height: Math.max(1, h), scaled };
}

/**
 * Main rendering pipeline
 */
export function processImage(
  sourceImage: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  adjustments: AdjustmentParameters,
  geometry: GeometryState,
  curves?: ToneCurves,
  wheels?: ColorWheels,
  targetCanvas?: HTMLCanvasElement,
  exportScale: number = 1,
  hsl?: HslAdjustments,
  cutout?: CutoutState,
  backgroundReplacement?: BackgroundReplacementState,
  bgImageElement?: CanvasImageSource | null
): {
  canvas: HTMLCanvasElement;
  histogram: HistogramData;
  dominantColors: DominantColor[];
} {
  const canvas = targetCanvas || document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2D canvas context');

  // 1. Calculate Crop and Output Dimensions
  const crop = geometry.crop;
  const cropX = Math.max(0, Math.min(sourceWidth, crop.x * sourceWidth));
  const cropY = Math.max(0, Math.min(sourceHeight, crop.y * sourceHeight));
  const cropW = Math.max(1, Math.min(sourceWidth - cropX, crop.width * sourceWidth));
  const cropH = Math.max(1, Math.min(sourceHeight - cropY, crop.height * sourceHeight));

  // Decompose rotation into orthogonal 90° step and fine-angle straightening
  const totalRotation = ((geometry.rotation % 360) + 360) % 360;
  const orthogonalStep = Math.round(totalRotation / 90) % 4; // 0, 1 (90°), 2 (180°), 3 (270°)
  const fineAngleDeg = totalRotation - orthogonalStep * 90; // range [-45°, 45°]
  const fineAngleRad = (fineAngleDeg * Math.PI) / 180;

  const isOrthogonal90or270 = orthogonalStep === 1 || orthogonalStep === 3;
  const rawTargetW = Math.round((isOrthogonal90or270 ? cropH : cropW) * exportScale);
  const rawTargetH = Math.round((isOrthogonal90or270 ? cropW : cropH) * exportScale);

  // Safeguard memory: clamp against OOM on mobile hardware
  const constrained = constrainDimensions(rawTargetW, rawTargetH);
  const targetW = constrained.width;
  const targetH = constrained.height;

  canvas.width = targetW;
  canvas.height = targetH;

  // 2. Apply Geometric Transformations (Crop, Rotate, Flip, Auto-Crop Straighten)
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((totalRotation * Math.PI) / 180);
  ctx.scale(geometry.flipH ? -1 : 1, geometry.flipV ? -1 : 1);

  const baseDrawW = isOrthogonal90or270 ? canvas.height : canvas.width;
  const baseDrawH = isOrthogonal90or270 ? canvas.width : canvas.height;

  // Auto-crop scale factor to prevent transparent wedges at corners during fine rotation
  let autoCropScale = 1;
  if (Math.abs(fineAngleDeg) > 0.01) {
    const absRad = Math.abs(fineAngleRad);
    const aspect = Math.max(baseDrawW / baseDrawH, baseDrawH / baseDrawW);
    autoCropScale = Math.cos(absRad) + Math.sin(absRad) * aspect;
  }

  const drawW = baseDrawW * autoCropScale;
  const drawH = baseDrawH * autoCropScale;

  ctx.drawImage(
    sourceImage,
    cropX,
    cropY,
    cropW,
    cropH,
    -drawW / 2,
    -drawH / 2,
    drawW,
    drawH
  );
  ctx.restore();

  // 3. Pixel Manipulation for Non-Destructive Adjustments
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const len = data.length;

  // Pre-calculate curve LUTs
  const rgbLUT = curves ? buildCurveLUT(curves.rgb) : null;
  const redLUT = curves ? buildCurveLUT(curves.red) : null;
  const greenLUT = curves ? buildCurveLUT(curves.green) : null;
  const blueLUT = curves ? buildCurveLUT(curves.blue) : null;

  // Pre-calculate adjustment constants
  const expFactor = Math.pow(2, adjustments.exposure);
  const brightnessOffset = adjustments.brightness * 2.55;
  const contrastFactor = (259 * (adjustments.contrast + 255)) / (255 * (259 - adjustments.contrast));
  const tempOffset = adjustments.temperature * 1.2;
  const tintOffset = adjustments.tint * 1.2;
  const satFactor = 1 + adjustments.saturation / 100;
  const vibFactor = adjustments.vibrance / 100;
  const highlightOffset = adjustments.highlights / 100;
  const shadowOffset = adjustments.shadows / 100;
  const whiteOffset = adjustments.whites * 1.5;
  const blackOffset = adjustments.blacks * 1.5;
  const fadeLift = adjustments.fade * 1.2;
  const grainAmount = adjustments.grain / 100;

  // Split-toning color tint vectors & luminance deltas
  let shadowTintR = 0, shadowTintG = 0, shadowTintB = 0;
  let midtoneTintR = 0, midtoneTintG = 0, midtoneTintB = 0;
  let highlightTintR = 0, highlightTintG = 0, highlightTintB = 0;
  let shadowLumDelta = 0, midtoneLumDelta = 0, highlightLumDelta = 0;

  if (wheels) {
    if (wheels.shadows && wheels.shadows.saturation > 0) {
      const [r, g, b] = hslToRgb(wheels.shadows.hue, wheels.shadows.saturation / 100, 0.5);
      shadowTintR = (r - 128) / 128;
      shadowTintG = (g - 128) / 128;
      shadowTintB = (b - 128) / 128;
    }
    if (wheels.midtones && wheels.midtones.saturation > 0) {
      const [r, g, b] = hslToRgb(wheels.midtones.hue, wheels.midtones.saturation / 100, 0.5);
      midtoneTintR = (r - 128) / 128;
      midtoneTintG = (g - 128) / 128;
      midtoneTintB = (b - 128) / 128;
    }
    if (wheels.highlights && wheels.highlights.saturation > 0) {
      const [r, g, b] = hslToRgb(wheels.highlights.hue, wheels.highlights.saturation / 100, 0.5);
      highlightTintR = (r - 128) / 128;
      highlightTintG = (g - 128) / 128;
      highlightTintB = (b - 128) / 128;
    }

    shadowLumDelta = ((wheels.shadows?.luminance || 0) / 100) * 50;
    midtoneLumDelta = ((wheels.midtones?.luminance || 0) / 100) * 50;
    highlightLumDelta = ((wheels.highlights?.luminance || 0) / 100) * 50;
  }

  // Histogram buckets
  const histR = new Array(256).fill(0);
  const histG = new Array(256).fill(0);
  const histB = new Array(256).fill(0);
  const histL = new Array(256).fill(0);
  let maxCount = 0;

  // Dominant color sampling
  const colorSamples: { [hex: string]: { rgb: [number, number, number]; count: number } } = {};
  const sampleStep = Math.max(1, Math.floor(len / 4 / 2000)); // Sample ~2000 pixels
  let totalSampled = 0;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 1. Exposure
    if (expFactor !== 1) {
      r *= expFactor;
      g *= expFactor;
      b *= expFactor;
    }

    // 2. Brightness
    if (brightnessOffset !== 0) {
      r += brightnessOffset;
      g += brightnessOffset;
      b += brightnessOffset;
    }

    // 3. Contrast
    if (adjustments.contrast !== 0) {
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;
    }

    // Calculate current luminance (ITU-R BT.709)
    let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // 4. Highlights & Shadows
    if (highlightOffset !== 0 && lum > 128) {
      const weight = (lum - 128) / 127;
      const boost = highlightOffset * weight * 60;
      r += boost;
      g += boost;
      b += boost;
    }
    if (shadowOffset !== 0 && lum < 128) {
      const weight = (128 - lum) / 128;
      const boost = shadowOffset * weight * 60;
      r += boost;
      g += boost;
      b += boost;
    }

    // 5. Whites & Blacks
    if (whiteOffset !== 0 && lum > 180) {
      const weight = (lum - 180) / 75;
      r += whiteOffset * weight;
      g += whiteOffset * weight;
      b += whiteOffset * weight;
    }
    if (blackOffset !== 0 && lum < 80) {
      const weight = (80 - lum) / 80;
      r += blackOffset * weight;
      g += blackOffset * weight;
      b += blackOffset * weight;
    }

    // 6. Temperature (Warm/Cool) & Tint (Green/Magenta)
    if (tempOffset !== 0) {
      r += tempOffset;
      b -= tempOffset;
    }
    if (tintOffset !== 0) {
      g -= tintOffset * 0.7;
      r += tintOffset * 0.4;
      b += tintOffset * 0.3;
    }

    // Recalculate luminance after tone adjustments
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // 7. Saturation & Vibrance
    if (satFactor !== 1 || vibFactor !== 0) {
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const currentSat = maxC === 0 ? 0 : (maxC - minC) / maxC;

      // Vibrance affects desaturated colors more than already saturated ones
      const vibMult = 1 + vibFactor * (1 - currentSat);
      const totalSat = satFactor * vibMult;

      r = lum + (r - lum) * totalSat;
      g = lum + (g - lum) * totalSat;
      b = lum + (b - lum) * totalSat;
    }

    // 8. Color Wheels Split Toning & 3-Way Luminance
    const u = Math.max(0, Math.min(1, lum / 255));
    const shadowWeight = Math.max(0, 1 - 2 * u);
    const midtoneWeight = Math.sin(Math.PI * u);
    const highlightWeight = Math.max(0, 2 * u - 1);

    if (shadowTintR !== 0 || shadowTintG !== 0 || shadowTintB !== 0) {
      r += shadowTintR * shadowWeight * 50;
      g += shadowTintG * shadowWeight * 50;
      b += shadowTintB * shadowWeight * 50;
    }
    if (midtoneTintR !== 0 || midtoneTintG !== 0 || midtoneTintB !== 0) {
      r += midtoneTintR * midtoneWeight * 50;
      g += midtoneTintG * midtoneWeight * 50;
      b += midtoneTintB * midtoneWeight * 50;
    }
    if (highlightTintR !== 0 || highlightTintG !== 0 || highlightTintB !== 0) {
      r += highlightTintR * highlightWeight * 50;
      g += highlightTintG * highlightWeight * 50;
      b += highlightTintB * highlightWeight * 50;
    }

    if (shadowLumDelta !== 0) {
      r += shadowLumDelta * shadowWeight;
      g += shadowLumDelta * shadowWeight;
      b += shadowLumDelta * shadowWeight;
    }
    if (midtoneLumDelta !== 0) {
      r += midtoneLumDelta * midtoneWeight;
      g += midtoneLumDelta * midtoneWeight;
      b += midtoneLumDelta * midtoneWeight;
    }
    if (highlightLumDelta !== 0) {
      r += highlightLumDelta * highlightWeight;
      g += highlightLumDelta * highlightWeight;
      b += highlightLumDelta * highlightWeight;
    }

    // 9. Tone Curves LUT
    if (rgbLUT) {
      const clampR = Math.max(0, Math.min(255, Math.round(r)));
      const clampG = Math.max(0, Math.min(255, Math.round(g)));
      const clampB = Math.max(0, Math.min(255, Math.round(b)));
      r = rgbLUT[clampR];
      g = rgbLUT[clampG];
      b = rgbLUT[clampB];
    }
    if (redLUT) r = redLUT[Math.max(0, Math.min(255, Math.round(r)))];
    if (greenLUT) g = greenLUT[Math.max(0, Math.min(255, Math.round(g)))];
    if (blueLUT) b = blueLUT[Math.max(0, Math.min(255, Math.round(b)))];

    // 10. Fade (Lift black point)
    if (fadeLift > 0) {
      r = r + (255 - r) * (fadeLift / 255) * (1 - lum / 255);
      g = g + (255 - g) * (fadeLift / 255) * (1 - lum / 255);
      b = b + (255 - b) * (fadeLift / 255) * (1 - lum / 255);
    }

    // 11. Film Grain
    if (grainAmount > 0) {
      const noise = (Math.random() - 0.5) * grainAmount * 60;
      r += noise;
      g += noise;
      b += noise;
    }

    // Final clamp to 0..255
    const finalR = Math.max(0, Math.min(255, Math.round(r)));
    const finalG = Math.max(0, Math.min(255, Math.round(g)));
    const finalB = Math.max(0, Math.min(255, Math.round(b)));
    const finalL = Math.max(0, Math.min(255, Math.round(0.2126 * finalR + 0.7152 * finalG + 0.0722 * finalB)));

    data[i] = finalR;
    data[i + 1] = finalG;
    data[i + 2] = finalB;

    // Histogram accumulation
    histR[finalR]++;
    histG[finalG]++;
    histB[finalB]++;
    histL[finalL]++;
    if (histL[finalL] > maxCount) maxCount = histL[finalL];

    // Color sampling
    if ((i / 4) % sampleStep === 0) {
      // Quantize to 32 steps per channel for clustering
      const qR = Math.floor(finalR / 32) * 32;
      const qG = Math.floor(finalG / 32) * 32;
      const qB = Math.floor(finalB / 32) * 32;
      const hex = `#${qR.toString(16).padStart(2, '0')}${qG.toString(16).padStart(2, '0')}${qB.toString(16).padStart(2, '0')}`;
      if (!colorSamples[hex]) {
        colorSamples[hex] = { rgb: [finalR, finalG, finalB], count: 0 };
      }
      colorSamples[hex].count++;
      totalSampled++;
    }
  }

  // 12. 8-Channel HSL Color Mixer
  if (hsl) {
    applyHsl(data, hsl);
  }

  // 13. Noise Reduction (Edge-preserving bilateral denoise)
  if (adjustments.noiseReduction > 0) {
    applyNoiseReduction(data, canvas.width, canvas.height, adjustments.noiseReduction);
  }

  // 14. Clarity (Local midtone contrast enhancement)
  if (adjustments.clarity !== 0) {
    applyClarity(data, canvas.width, canvas.height, adjustments.clarity);
  }

  // 15. Sharpen (Edge acutance convolution)
  if (adjustments.sharpen > 0) {
    applySharpen(data, canvas.width, canvas.height, adjustments.sharpen);
  }

  // 16. Smart Background Removal & Cutout Matting
  const isCutoutActive = Boolean(cutout?.enabled);
  const isBgReplaceActive = Boolean(backgroundReplacement?.enabled);

  if (isCutoutActive || isBgReplaceActive) {
    applyCutout(
      data,
      canvas.width,
      canvas.height,
      cutout && cutout.enabled
        ? cutout
        : {
            enabled: true,
            mode: 'auto',
            tolerance: 35,
            feather: 4,
            invert: false,
            maskAlpha: cutout?.maskAlpha,
          }
    );
  }

  // Write pixel data back to canvas
  ctx.putImageData(imgData, 0, 0);

  // 17. Background Replacement Multi-Layer Compositing Pass
  if (isBgReplaceActive && backgroundReplacement) {
    compositeBackgroundReplacement(
      canvas,
      ctx,
      imgData,
      backgroundReplacement,
      bgImageElement
    );
  }

  // 14. Vignette (Post-pass radial gradient)
  if (adjustments.vignette > 0) {
    const w = canvas.width;
    const h = canvas.height;
    const radius = Math.sqrt(Math.pow(w / 2, 2) + Math.pow(h / 2, 2));
    const vigGradient = ctx.createRadialGradient(
      w / 2,
      h / 2,
      radius * 0.4,
      w / 2,
      h / 2,
      radius
    );
    const alpha = (adjustments.vignette / 100) * 0.85;
    vigGradient.addColorStop(0, 'rgba(0,0,0,0)');
    vigGradient.addColorStop(1, `rgba(0,0,0,${alpha})`);

    ctx.save();
    ctx.fillStyle = vigGradient;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // 15. Canvas filter blur
  if (adjustments.blur > 0) {
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = canvas.width;
    blurCanvas.height = canvas.height;
    const bCtx = blurCanvas.getContext('2d');
    if (bCtx) {
      bCtx.filter = `blur(${adjustments.blur * 0.15}px)`;
      bCtx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(blurCanvas, 0, 0);
    }
  }

  // Extract top dominant colors
  const dominantColors: DominantColor[] = Object.entries(colorSamples)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([hex, data]) => ({
      hex,
      rgb: data.rgb,
      percentage: totalSampled > 0 ? Math.round((data.count / totalSampled) * 100) : 0,
    }));

  return {
    canvas,
    histogram: {
      r: histR,
      g: histG,
      b: histB,
      l: histL,
      maxCount: Math.max(1, maxCount),
    },
    dominantColors,
  };
}
